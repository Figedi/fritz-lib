const { merge, get } = require('lodash');
const Eventemitter = require('eventemitter3');

const { fetchJSON } = require('./utils');
const { EVENTS, KINDS, DEFAULT_OPTS } = require('./constants');
const { FritzInfoError, UnauthorizedError, SIDError } = require('./common');

module.exports = class Info extends Eventemitter {
  constructor(auth, opts = {}) {
    super();
    this.auth = auth;
    this.opts = merge({}, DEFAULT_OPTS, auth.opts, opts);
  }

  OSUrl(token) {
    const { credentials: { base } } = this.opts;
    return `${base}/data.lua?sid=${token}&useajax=1&page=overview&xhr=1`;
  }

  async getOS() {
    try {
      const token = await this.auth.getToken('token');
      const response = await fetchJSON(this.OSUrl(token));
      const OSVersion = get(response, 'data.fritzos.nspver');

      this.emit(EVENTS.DATA, { kind: KINDS.INFO, response: OSVersion });
      return OSVersion;
    } catch (e) {
      // intermediate emit, then re-throw
      this.emit(EVENTS.ERROR, { kind: KINDS.INFO, error: e });
      if (e instanceof UnauthorizedError) {
        throw e;
        // when there is a SIDError while getting info-data, the user
        // authenticated by password. For clarity we also return an UnauthorizedError
        // here and ignore the SIDError (in this context, the errors are semantically
        // the same)
      } else if (e instanceof SIDError) {
        throw new UnauthorizedError('Unauthorized');
      }
      throw new FritzInfoError('Error while fetching info-data', e);
    }
  }
};
