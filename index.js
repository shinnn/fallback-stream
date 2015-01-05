/*!
 * fallback-stream | MIT (c) Shinnosuke Watanabe
 * https://github.com/shinnn/fallback-stream
*/
'use strict';

var multistream = require('multistream');

function alwaysTrue() {
  return true;
}

module.exports = function fallbackStream(sourceStreams, options) {
  if (!Array.isArray(sourceStreams)) {
    throw new TypeError(
      sourceStreams +
      ' is not an array. The first argument to fallback-stream must be an array.'
    );
  }

  var filter;
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
        throw new TypeError(
          'Error filter must be a function or a regular expression, but it was ' +
          typeof options.errorFilter + '.'
        );
      }
    }
  }

  filter = filter || alwaysTrue;

  var result = multistream(sourceStreams.map(function(stream, index) {
    return function() {
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

      var needsFallback = false;
      var errorListeners = [];

      stream.once('error', function cancelError(err) {
        if (filter(err)) {
          needsFallback = true;
          result._errors.push(err);
          stream.emit('end');
          return;
        }

        errorListeners.forEach(function(listener) {
          stream.on('error', listener);
        });
        stream.emit('error', err);
      });

      stream.on('newListener', function removeDefaultErrorListeners(eventName, listener) {
        if (eventName === 'error') {
          errorListeners.push(listener);
        } else if (eventName === 'close') {
          errorListeners.forEach(function(errorListener) {
            stream.removeListener('error', errorListener);
          });
        }
      });

      stream.once('end', function end() {
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
