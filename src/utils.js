/* eslint-disable no-mixed-operators */
const { reduce, range } = require('lodash');
const fetch = require('node-fetch');
const { parseString } = require('xml2js');

// ======================== graph/set utils ====================================

/**
 * Returns the difference of two Arrays from which the latter was just a
 * left shifted version of the former. Thus we only need to find the first
 * Element of Array B in Array A from right to left
 *
 * @param {Array} arrayA The first Array (old)
 * @param {Array} arrayB The second Array (new)
 *
 * @return {Array}       Returns the difference from the given index or Array A
 */
function setDifference(arrayA, arrayB = []) {
  for (let i = arrayB.length - 1; i >= 0; i -= 1) {
    if (arrayB[i] === arrayA[arrayA.length - 1]) {
      return arrayB.slice(i + 1, arrayB.length);
    }
  }
  return arrayA.slice();
}

exports.setDifference = setDifference;

/**
 * @todo Should enable mode where we only subtract every 5 seconds
 * (for first time usage)
 * @todo do NOT allow 0, this is incorrect (rather take the last point)
 *
 * Maps a new and old series to their difference and adds a timestamp.
 * timestamps are lineary calculated
 *
 * @param  {Object} oldData  The old request result
 * @param  {Object} newData  The new request result
 * @param  {Number} dateNow    Date absolute Number from new request

 * @return {Object}            Returns a mapped version of the diff
 */
function interpolateDataPoint(oldData, newData, dateNow) {
  let longest = -1;
  const diffData = reduce(
    newData,
    (acc, data, key) => {
      const diff = setDifference(oldData[key], data);
      if (diff.length > longest) {
        longest = diff.length;
      }
      return Object.assign({}, acc, {
        [key]: diff.length ? diff : [oldData[key][oldData[key].length - 1]],
      });
    },
    {}
  );
  // if unchanged (i.e. diff([0,0..], [0,0...]) = []), fill up with one single
  // 0, then one single date
  longest = longest === -1 ? 1 : longest;
  const timeSeries = range(0, longest).map((v, i) => parseInt(dateNow - 1000 * ((longest - i) * (5 / longest)), 10));
  return { x: timeSeries, columns: diffData };
}

exports.interpolateDataPoint = interpolateDataPoint;

// ========================== auth utils =======================================

exports.fetchText = (...args) => fetch(...args).then(response => response.text());
exports.promiseParseString = (...args) =>
  new Promise((resolve, reject) => {
    const argv = [...args, (err, result) => (err ? reject(err) : resolve(result))];
    return parseString(argv);
  });

// ================================ other utils ================================

exports.sleep = time => new Promise(resolve => setTimeout(resolve, time));
