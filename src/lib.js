const { isString } = require('lodash');
const Auth = require('./auth');
const Graph = require('./graph');
const Eventemitter = require('eventemitter3');

const { EVENTS, MAX_AUTH_TRIES } = require('./constants');
const { SIDError, AuthTriesExceedError } = require('./common');
const { sleep } = require('./utils');

module.exports = class FritzLib extends Eventemitter {
  constructor(authOpts = {}) {
    super();
    this.auth = new Auth(authOpts);
    this.graph = null;
    this.token = null;
    this.authTries = MAX_AUTH_TRIES;

    this.tryReAuth = this.tryReAuth.bind(this);
  }

  bindEvents() {
    this.graph.once(EVENTS.UNAUTHENTICATED, this.tryReAuth);
  }

  async authenticate() {
    try {
      this.authTries -= 1;
      this.token = await this.auth.authenticate();

      return this.token;
    } catch (e) {
      return this.tryReAuth(e); // either returns from this.authenticate or throws
    }
  }

  async tryReAuth(lastError) {
    this.graph = null;
    if (this.authTries > 0) {
      if (lastError instanceof SIDError) {
        console.warn(`There was an SID-Error, however we have to sleep for another ${lastError.blockTime} seconds 💤`);
        await sleep(lastError.blockTime * 1000); // blocktime is in s, not ms
        console.warn('Continuing with connection retry');
      }
      return this.authenticate();
    }
    const error = new AuthTriesExceedError(`Auth tries of ${MAX_AUTH_TRIES} exceeded`, lastError);
    this.emit(EVENTS.ERROR, { error });
    throw error;
  }

  async getGraph(token) {
    if (isString(token) && token.length) {
      this.token = token;
    }
    if (!this.token) {
      await this.authenticate();
    }
    if (!this.graph) {
      this.graph = new Graph(this.token);
      this.bindEvents();
      this.emit(EVENTS.READY);
    }
    return this.graph.getGraph();
  }
};
