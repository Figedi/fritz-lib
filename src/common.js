// ============================ Auth Errors ====================================
exports.SIDError = class SIDError extends Error {
  constructor(message, blockTime) {
    super(message);
    this.message = message;
    this.name = 'SIDError';
    this.blockTime = blockTime;
  }
};

exports.ChallengeError = class ChallengeError extends Error {
  constructor(message) {
    super(message);
    this.message = message;
    this.name = 'ChallengeError';
  }
};

exports.AuthTriesExceedError = class AuthTriesExceedError extends Error {
  constructor(message, lastError) {
    super(message);
    this.message = message;
    this.name = 'AuthTriesExceedError';
    this.lastError = lastError;
  }
};

exports.UnauthorizedError = class UnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.message = message;
    this.name = 'UnauthorizedError';
  }
};

// ============================ Graph Errors ====================================

exports.GraphFetchError = class GraphFetchError extends Error {
  constructor(message, error) {
    super(message);
    this.message = message;
    this.name = 'GraphFetchError';
    this.error = error;
  }
};

exports.GraphParseError = class GraphParseError extends Error {
  constructor(message, error) {
    super(message);
    this.message = message;
    this.name = 'GraphParseError';
    this.error = error;
  }
};

// ============================ Info Errors ====================================

exports.FritzInfoError = class FritzInfoError extends Error {
  constructor(message, error) {
    super(message);
    this.message = message;
    this.name = 'FritzInfoError';
    this.error = error;
  }
};
