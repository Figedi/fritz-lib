const { merge } = require('lodash');
const crypto = require('crypto');

const { DEFAULT_OPTS } = require('./constants');
const { fetchText, promiseParseString } = require('./utils');
const { SIDError, ChallengeError } = require('./common');

module.exports = class Auth {
  constructor(opts = {}) {
    this.opts = merge({}, DEFAULT_OPTS, opts);
    this.token = null;
    this.tokenAt = null;
  }

  /**
   *
   * Authenticates to the Fritz Router according to spec. (Challenge -> Response
   * -> SID)
   *
   * @return {Async}             Async Response, returns Promise
   */
  async authenticate() {
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
   * Validates whether a token is still valid. Right now we are setting the
   * valid time to 200000 (tested with own router)
   *
   * @return {Boolean} True when token is valid, false otherwise
   */
  tokenValid() {
    const now = +new Date();
    if (this.token && this.tokenAt && now - this.tokenAt < 200000) {
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
    md5.update(`${challenge}-${password}`, 'ucs2'); // 16 - Unicode
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
    const result = await promiseParseString(xml);
    const token = result.SessionInfo.SID[0];
    if (token && token !== '0000000000000000') {
      return token;
    }
    throw new SIDError(`No SID created, was: ${token}`, +result.SessionInfo.BlockTime[0]);
  }

  /**
   * Gets the challenge by parsing the xml and returning the Challenge-Field
   *
   * @param  {String}   xml      The raw xml String
   *
   * @return {Promise}             Async response, returning Promise
   */
  async getChallenge(xml) {
    const result = await promiseParseString(xml);
    const challenge = result.SessionInfo.Challenge;
    if (challenge) {
      return challenge[0]; // is always an array with one element
    }
    throw new ChallengeError('No challenge found');
  }
};
