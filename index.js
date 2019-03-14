'use strict';

const multistream = require('multistream');

function alwaysTrue() {
  return true;
}

module.exports = function fallbackStream(sourceStreams, options) {
  if (!Array.isArray(sourceStreams)) {
    throw new TypeError(`${sourceStreams} is not an array. The first argument to fallback-stream must be an array.`);
  }

  let filter;
  options = options || {};

  if (typeof options !== 'object' || options instanceof RegExp) {
    options = {errorFilter: options};
  }

  if (options.errorFilter) {
    if (typeof options.errorFilter === 'function') {
      filter = options.errorFilter;
    } else {
      if (options.errorFilter instanceof RegExp) {
        filter = function(err) {
          return options.errorFilter.test(err);
        };
      } else {
        throw new TypeError(`Error filter must be a function or a regular expression, but it was ${typeof options.errorFilter}.`);
      }
    }
  }

  filter = filter || alwaysTrue;

  const result = multistream(sourceStreams.map((stream, index) => {
    return () => {
      if (typeof stream === 'function') {
        stream = stream();
        if (!stream || typeof stream.on !== 'function') {
          throw new TypeError('All functions in the array must return a readable stream.');
        }
      } else if (!stream || typeof stream.on !== 'function') {
        throw new TypeError('All items in the array must be a readable stream or a function.');
      }

      if (sourceStreams.length === 1 || index === sourceStreams.length - 1) {
        return stream;
      }

      let needsFallback = false;
      const errorListeners = [];

      stream.once('error', function cancelError(err) {
        if (filter(err)) {
          needsFallback = true;
          result._errors.push(err);
          stream.emit('end');
          return;
        }

        for (const listener of [...errorListeners]) {
          stream.on('error', listener);
        }

        stream.emit('error', err);
      });

      stream.on('newListener', function removeDefaultErrorListeners(eventName, listener) {
        if (eventName === 'error') {
          errorListeners.push(listener);
          return;
        }

        if (eventName === 'close') {
          for (const listener of errorListeners) {
            stream.removeListener('error', listener);
          }
        }
      });

      stream.once('end', () => {
        if (!needsFallback) {
          result._queue = [];
        }
      });

      return stream;
    };
  }), options);

  result._errors = [];
  return result;
};
