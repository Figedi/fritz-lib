// common constants for eventemitter
exports.EVENTS = {
  ERROR: 'ERROR',
  DATA: 'DATA',
};

exports.KINDS = {
  GRAPH: 'GRAPH',
  INFO: 'INFO',
  TOKEN: 'TOKEN',
};

// auth constants

exports.MAX_AUTH_TRIES = 2;
exports.TOKEN_VALIDITY = 200000;
exports.DEFAULT_OPTS = {
  credentials: {
    base: 'http://fritz.box',
    login: '/login_sid.lua',
    username: 'admin',
    password: 'admin',
  },
};

// graph constants

exports.DEFAULT_INTERVAL = 5000;
