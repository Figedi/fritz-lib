#!/usr/bin/env node --harmony

/* eslint-disable no-console */
const parseArgs = require('minimist');
const { isNumber } = require('lodash');

const FritzLib = require('../src');
const { AuthTriesExceedError } = require('../src/common');
const { DEFAULT_INTERVAL } = require('../src/constants');

const args = parseArgs(process.argv.slice(2));
const fritz = new FritzLib({
  credentials: {
    password: args.password,
  },
});

if (args.interval) {
  let interval = isNumber(args.interval) ? args.interval : DEFAULT_INTERVAL;
  if (interval < DEFAULT_INTERVAL) {
    console.warn('Chosen interval is smaller than 5s, defaulting to 5s');
    interval = DEFAULT_INTERVAL;
  }
  setInterval(() => {
    fritz.getGraph(args.token).then(console.log).catch(e => {
      if (e instanceof AuthTriesExceedError) {
        return console.log('Error due to exceeding limit, lastError:', e.lastError);
      }
      return console.error('Error while fetching graph-data', e);
    });
  }, interval);
} else if (args.getToken) {
  fritz
    .authenticate()
    .then(token => {
      console.log('Your token is', token);
      return token;
    })
    .catch(e => {
      console.error('Error while fetching token: ', e);
    });
} else {
  console.error("I don't know what to do with your arguments, beep boop 🤔");
}
