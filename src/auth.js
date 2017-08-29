/* eslint-disable no-await-in-loop */
const { merge } = require('lodash');
const crypto = require('crypto');

const { DEFAULT_OPTS, MAX_AUTH_TRIES, TOKEN_VALIDITY } = require('./constants');
const { fetchText, sleep } = require('./utils');
const { SIDError, ChallengeError, AuthTriesExceedError } = require('./common');

const CHALLENGE_REGEX = /<Challenge[^>]*>(.+?)<\/Challenge>/;
const BLOCKTIME_REGEX = /<BlockTime[^>]*>(.+?)<\/BlockTime>/;
const SID_REGEX = /<SID[^>]*>(.+?)<\/SID>/;

module.exports = class Auth {
  constructor(opts = {}) {
    this.opts = merge({}, DEFAULT_OPTS, opts);
    this.token = null;
    this.tokenAt = null;
    this.authTries = 0;
  }

  /**
   *
   * Authenticates to the Fritz Router according to spec. (Challenge -> Response
   * -> SID)
   *
   * @return {Async}             Async Response, returns Promise
   */
  async doAuth() {
    if (this.tokenValid()) {
      return this.token;
    }
    const { credentials: { username, base, login } } = this.opts;
    const initialResponse = await fetchText(`${base}${login}`);
    const challenge = await this.getChallenge(initialResponse);
    const encodedChallenge = await this.encodeResponse(challenge);
    const challengeResponse = await fetchText(`${base}${login}?username=${username}&response=${encodedChallenge}`);

    this.token = await this.getToken(challengeResponse);
    this.tokenAt = +new Date();
    return this.token;
  }

  /**
   *
   * Public fn which tries to authenticate the user, retries *n*-times
   *
   * @return {Async}             Returns the token when successfull
   */
  async authenticate() {
    let lastError;
    while (this.authTries < MAX_AUTH_TRIES) {
      try {
        return this.doAuth();
      } catch (e) {
        lastError = e;
        if (e instanceof SIDError) {
          console.warn(`There was an SID-Error, however we have to sleep for another ${e.blockTime} seconds 💤`);
          await sleep(e.blockTime * 1000); // blocktime is in s, not ms
          console.info('Continuing with connection retry');
        }
      }
    }
    const error = new AuthTriesExceedError(`Auth tries of ${MAX_AUTH_TRIES} exceeded`, lastError);
    throw error;
  }

  /**
   * Validates whether a token is still valid. Right now we are setting the
   * valid time to 200000 (tested with own router)
   *
   * @return {Boolean} True when token is valid, false otherwise
   */
  tokenValid() {
    const now = +new Date();
    if (this.token && this.tokenAt && now - this.tokenAt < TOKEN_VALIDITY) {
      return true;
    }
    // invalidate, then return
    this.token = null;
    this.tokenAt = null;
    return false;
  }
  /**
   * Encodes the response by executing plain programs through CLI.
   * Note that this only works for mac right now (md5 package, iconv should be
   * present everywhere)
   *
   * @param  {String}   challenge The challenge from the router
   *
   * @return {Promise}            Async response, returning Promise
   */
  async encodeResponse(challenge) {
    const { credentials: { password } } = this.opts;
    // fritzbox requires your challenge to be an UTF-16LE string, md5 hashed
    const md5 = crypto.createHash('md5');
    md5.update(`${challenge}-${password}`, 'ucs2'); // ucs2 = UTF-16LE
    const digest = md5.digest('hex');
    return `${challenge}-${digest}`;
  }

  /**
   * Gets the token by parsing the xml and returning the SID field
   *
   * @param  {String}   xml      The raw xml String
   *
   * @return {Promise}           Async response, returning Promise
   */
  async getToken(xml) {
    debugger;
    const match = xml.trim().match(SID_REGEX);
    if (match) {
      const [, token] = match;
      if (token === '0000000000000000') {
        const [, blockTime] = xml.trim().match(BLOCKTIME_REGEX);
        throw new SIDError(`No SID created, was: ${token}`, +blockTime);
      }
      return token;
    }
    throw new Error('Unknown error during parsing occured');
  }

  /**
   * Gets the challenge by parsing the xml and returning the Challenge-Field
   *
   * @param  {String}   xml      The raw xml String
   *
   * @return {Promise}             Async response, returning Promise
   */
  async getChallenge(xml) {
    debugger;
    const match = xml.trim().match(CHALLENGE_REGEX);
    if (match) {
      return match[1];
    }
    throw new ChallengeError('No challenge found');
  }
};
