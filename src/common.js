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
