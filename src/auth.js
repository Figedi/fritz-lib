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
  static byToken(opts, token, tokenAt) {
    const authOpts = merge({}, opts, { skipValidity: !tokenAt });
    return new Auth(authOpts, token, tokenAt);
  }

  constructor(opts = {}, token = null, tokenAt = null) {
    this.opts = merge({}, DEFAULT_OPTS, opts);
    this.token = token;
    this.tokenAt = tokenAt;
    this.authTries = 0;
  }

  /**
   *
   * Authenticates to the Fritz Router according to spec. (Challenge -> Response
   * -> SID). Returns the token when its either still valid or a new one was
   * successfully fetched.
   *
   * @return {Async}             Returns the token.
   */
  async doAuth() {
    if (this.tokenValid()) {
      return { token: this.token, tokenAt: this.tokenAt };
    }
    const { credentials: { username, base, login } } = this.opts;
    const initialResponse = await fetchText(`${base}${login}`);
    const challenge = await this.getChallenge(initialResponse);
    const encodedChallenge = await this.encodeResponse(challenge);
    const challengeResponse = await fetchText(`${base}${login}?username=${username}&response=${encodedChallenge}`);

    this.token = await this.getTokenFromResponse(challengeResponse);
    this.tokenAt = +new Date();
    return { token: this.token, tokenAt: this.tokenAt };
  }

  /**
   * Shorthand getter for token, can return the token directly or the full
   * token-Object containing the validity
   *
   * @method getToken
   * @param  {String}  [attribute] Optional attribute to get (e.g. only the token)
   * @return {any}                 Returns either the full object or the attribute's value
   */
  async getToken(attribute) {
    const tokenObj = await this.doAuth();
    if (!attribute) {
      return tokenObj;
    }
    return tokenObj[attribute];
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
        return this.getToken();
      } catch (e) {
        lastError = e;
        if (e instanceof SIDError) {
          console.warn(`There was an SID-Error, however we have to sleep for another ${e.blockTime} seconds 💤`);
          await sleep(e.blockTime * 1000); // blocktime is in s, not ms
          console.info('Continuing with connection retry');
        }
      }
    }
    throw new AuthTriesExceedError(`Auth tries of ${MAX_AUTH_TRIES} exceeded`, lastError);
  }

  /**
   * Validates whether a token is still valid. Right now we are setting the
   * valid time to 200000 (tested with own router)
   *
   * @return {Boolean} True when token is valid, false otherwise
   */
  tokenValid() {
    const now = +new Date();
    if (this.opts.skipValidity || (this.token && this.tokenAt && now - this.tokenAt < TOKEN_VALIDITY)) {
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
  async getTokenFromResponse(xml) {
    if (!xml || !xml.length) {
      throw new Error('XML-Token-Response is empty');
    }
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
    if (!xml || !xml.length) {
      throw new Error('XML-Challenge-Response is empty');
    }
    const match = xml.trim().match(CHALLENGE_REGEX);
    if (match) {
      return match[1];
    }
    throw new ChallengeError('No challenge found');
  }
};
