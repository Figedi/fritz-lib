#!/usr/bin/env node --harmony

/* eslint-disable no-console */
const parseArgs = require('minimist');
const { isNumber } = require('lodash');

const { Auth, Graph, Info } = require('../src');
const { DEFAULT_INTERVAL } = require('../src/constants');

const args = parseArgs(process.argv.slice(2));

function createAuthOpts() {
  return {
    credentials: {
      base: args.ip,
      username: args.username,
      password: args.password,
    },
  };
}

function getAuth() {
  const authOpts = createAuthOpts();
  if (args.token) {
    return Auth.byToken(authOpts, args.token, args.tokenAt);
  }
  return new Auth(authOpts);
}

function run() {
  execCmd()
    // eslint-disable-next-line promise/always-return
    .then(data => {
      console.log(data);
      process.exit(0);
    })
    .catch(e => {
      console.error(e.message);
      process.exit(1);
    });
}
// always run cmd first
run();

// rerun if interval is desired
if (args.interval) {
  let interval = isNumber(args.interval) ? args.interval : DEFAULT_INTERVAL;
  if (interval < DEFAULT_INTERVAL) {
    console.warn('Chosen interval is smaller than 5s, defaulting to 5s');
    interval = DEFAULT_INTERVAL;
  }
  setInterval(run, interval);
}

async function execCmd() {
  const auth = getAuth();
  if (args['get-token']) {
    const tokenObj = await auth.authenticate();
    return tokenObj.token;
  } else if (args['get-graph']) {
    return new Graph(auth).getGraph();
  } else if (args['get-os']) {
    return new Info(auth).getOS();
  }
  throw new Error("I don't know what to do with your arguments, beep boop 🤔");
}
