/* eslint-disable no-mixed-operators */
const { merge, range, chain } = require('lodash');
const Eventemitter = require('eventemitter3');

const { fetchText, interpolateDataPoint } = require('./utils');
const { EVENTS, DEFAULT_OPTS } = require('./constants');
const { GraphFetchError, GraphParseError } = require('./common');

const TRANSFORMS = {
  upstream: {
    prio_default_bps: 'default',
    prio_high_bps: 'high',
    prio_low_bps: 'low',
    prio_realtime_bps: 'realtime',
  },
  downstream: {
    mc_current_bps: 'media',
    ds_current_bps: 'internet',
  },
};

module.exports = class Graph extends Eventemitter {
  constructor(token, opts = {}) {
    super();
    this.lastCall = {};
    this.token = token;
    this.opts = merge({}, DEFAULT_OPTS, opts);
  }

  /**
   * Initial substraction, calculates for every datapoint the date by
   * subtracting 5s each.
   *
   * Fills up shorter fields, if neccessary
   *
   * @param  {Object} newData New data object
   * @param  {Number} dateNow Number representing date in GMT
   *
   * @return {Object}         Returns the timeseries (x) and columns (data)
   */
  subtractDataPoint(newData, dateNow) {
    const timeSeries = range(20).map((k, i) => dateNow - 5000 * i).reverse();
    return {
      x: timeSeries,
      columns: Object.keys(newData).reduce((acc, key) => {
        let data = newData[key].slice();
        if (data.length < timeSeries.length) {
          const diff = timeSeries.length - data.length - 1;
          data = range(0, diff, 0).concat(data);
        }
        return Object.assign({}, acc, { [key]: data });
      }, {}),
    };
  }

  /**
   * @todo besserer check, wir müssen auf object testen, ob alle values leer sind
   *
   * @param  {Object} oldData   Data from previous request
   * @param  {Object} newData   New data form current request
   * @param  {Number} dateNow   Number representing current date in GMT
   *
   * @return {Object}           Returns the formatted data
   */
  formatDataPoint(oldData, newData, dateNow) {
    const isEmpty = !oldData || chain(newData).map(value => value.length).max().value().length === 0;
    if (isEmpty) {
      return this.subtractDataPoint(newData, dateNow);
    }
    return interpolateDataPoint(oldData, newData, dateNow);
  }

  /**
   * Helper method, gets the sum of upstream/downstream of the first element of
   * each category
   *
   * @param  {Object} data The data object from the request
   *
   * @return {Integer}     Returns the sum of all categories.
   */
  getTotal(data) {
    return Object.keys(data).reduce((acc, key) => acc + data[key][data[key].length - 1], 0.0).toFixed(3);
  }

  bandwidthURL(dateNow) {
    const { credentials: { base } } = this.opts;
    return `${base}/internet/inetstat_monitor.lua?sid=${this
      .token}&useajax=1&action=get_graphic&xhr=1&t${dateNow}=nocache`;
  }

  normalize(parsedData) {
    // debugger;
    return {
      parsedData,
      normalizedData: Object.keys(TRANSFORMS).reduce((acc, key) => {
        const typeTransform = TRANSFORMS[key];
        const data = Object.keys(typeTransform).reduce((typeAcc, typeKey) => {
          const value = typeTransform[typeKey];
          return Object.assign({}, typeAcc, {
            [value]: parsedData[typeKey].map(date => +date * 0.008).reverse(),
          });
        }, {});
        return Object.assign({}, acc, { [key]: data });
      }, {}),
    };
  }

  format(dateNow, { parsedData, normalizedData }) {
    const oldData = this.lastCall;
    const result = {
      dateReq: dateNow,
      available: {
        upstream: +parsedData.upstream / 1000,
        downstream: +parsedData.downstream / 1000,
      },
      max: {
        upstream: +parsedData.max_us / 1000,
        downstream: +parsedData.max_ds / 1000,
      },
      current: {
        upstream: {
          data: this.formatDataPoint(oldData.upstream, normalizedData.upstream, dateNow),
          $total: this.getTotal(normalizedData.upstream),
        },
        downstream: {
          data: this.formatDataPoint(oldData.downstream, normalizedData.downstream, dateNow),
          $total: this.getTotal(normalizedData.downstream),
        },
      },
    };
    this.lastCall = normalizedData;
    return result;
  }

  /**
   *
   * Gets the current Bandwidth usage. Should only be called every 5 seconds.
   * Returns data by normalizing to kbit/s. Also we are just returning
   * the difference from the last request since the router always performs
   * a right shift (N-times) from the last request to provide additional data.
   *
   * @return {Async}             Async response, returning Promise
   */
  async getGraph() {
    const dateNow = +new Date();
    let response;
    try {
      response = await fetchText(this.bandwidthURL(dateNow));
    } catch (e) {
      this.emit(EVENTS.ERROR, { error: e }); // intermediate emit, then re-throw
      throw new GraphFetchError('Error while fetching graph-data', e);
    }
    try {
      const parsedResponse = JSON.parse(response)[0];
      const normalizedResponse = this.normalize(parsedResponse);
      const formattedResponse = this.format(dateNow, normalizedResponse);

      this.emit(EVENTS.GRAPH_DATA, { response: formattedResponse }); // intermediate emit, then re-throw
      return formattedResponse;
    } catch (e) {
      this.emit(EVENTS.ERROR, { error: e }); // intermediate emit, then re-throw
      throw new GraphParseError('Error while parsing graph-data', e);
    }
  }
};
