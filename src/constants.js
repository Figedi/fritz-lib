exports.EVENTS = {
  AUTHENTICATE: 'AUTHENTICATE',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  ERROR: 'ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  GRAPH_DATA: 'GRAPH_DATA',
  READY: 'READY',
};

exports.MAX_AUTH_TRIES = 2;

exports.DEFAULT_INTERVAL = 5000;

exports.DEFAULT_OPTS = {
  credentials: {
    base: 'http://fritz.box',
    login: '/login_sid.lua',
    username: 'admin',
    password: 'admin',
  },
};
