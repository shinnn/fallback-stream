'use strict';

var fallbackStream = require('./');
var from = require('from2-array');
var test = require('tape');
var through = require('through2');

var tmpError = new Error();

function emitTmpErrorImmediately(stream) {
  process.nextTick(function() {
    stream.emit('error', tmpError);
  });
  return stream;
}

test('fallbackStream()', function(t) {
  t.plan(22);

  t.equal(fallbackStream.name, 'fallbackStream', 'must have a function name.');

  var option = {};

  fallbackStream([from('a')], option)
    .on('error', t.fail)
    .on('data', function(data) {
      t.equal(data.toString(), 'a', 'should create a readable stream.');
      t.deepEqual(option, {}, 'should not modify the original option object.');
    })
    .on('end', function() {
      t.deepEqual(this._errors, [], 'should set `_errors` property.');
    });

  fallbackStream([from('a'), from('b')])
    .on('error', t.fail)
    .on('data', function(data) {
      t.equal(
        data.toString(),
        'a',
        'should use only the first stream when it doesn\'t emit any errors.'
      );
    });

  fallbackStream([from.bind(null, 'a')])
    .on('error', t.fail)
    .on('data', function(data) {
      t.equal(
        data.toString(),
        'a',
        'should accept a function that returns a stream as a stream source.'
      );
    });

  fallbackStream([emitTmpErrorImmediately.bind(null, through())])
    .on('error', function(err) {
      t.equal(err, tmpError, 'should emit an error when the last stream emits an error.');
      t.deepEqual(
        this._errors,
        [],
        'should not push the error to the `_errors` property when it\'s actually emitted.'
      );
    });

  var willEmitError = from('');

  fallbackStream([
    willEmitError,
    from('a')
  ])
    .on('error', t.fail)
    .on('data', function(data) {
      t.equal(
        data.toString(),
        'a',
        'should use the next stream as a fallback when the current stream emits an error.'
      );
    })
    .on('end', function() {
      t.deepEqual(
        this._errors,
        [tmpError],
        'should push the ignored errors to the `_errors` property.'
      );
    });

  willEmitError.on('error', function(err) {
    t.equal(err, tmpError, 'should not remove error event listeners explicitly added.');
  });
  willEmitError.emit('error', tmpError);

  var alreadyEnded = from('a');
  alreadyEnded.pipe(through());
  alreadyEnded.on('end', function() {
    fallbackStream([alreadyEnded, from('b')], null)
      .on('data', t.notOk)
      .on('error', t.fail);

    t.ok(
      alreadyEnded._readableState.ended,
      'should stop fallback when the stream have already ended.'
    );
  });

  fallbackStream([
    emitTmpErrorImmediately.bind(null, through()),
    through()
  ], function(err) {
    return err.message === '__does_not_match__';
  })
    .on('error', function(err) {
      t.deepEqual(err, tmpError, 'should use a function as an error filter.');
    });

  fallbackStream([
    function() {
      var stream = through();
      process.nextTick(function() {
        stream.emit('error', new TypeError());
      });
      return stream;
    },
    emitTmpErrorImmediately.bind(null, through()),
    through()
  ], /TypeError/)
    .on('error', function(err) {
      t.equal(err, tmpError, 'should use a regular expression as an error filter.');
    });

  fallbackStream([
    emitTmpErrorImmediately.bind(null, through.obj()),
    from.obj({a: 1})
  ], {
    objectMode: true,
    errorFilter: function(err) {
      t.equal(err, tmpError, 'should use `errorFilter` option as an error filter.');
      return true;
    }
  })
    .on('error', t.fail)
    .on('data', function(data) {
      t.deepEqual(data, {a: 1}, 'should reflect readable stream options to the result.');
    });

  t.throws(
    fallbackStream.bind(null, from('a')),
    /TypeError.* is not an array.*must be an array/,
    'should throw a type error when the first argument is not an array.'
  );

  t.throws(
    fallbackStream.bind(null, [function() {}]),
    /TypeError.*must return a readable stream/,
    'should throw a type error when the function returns a non-stream value.'
  );

  t.throws(
    fallbackStream.bind(null, [{a: 1}, null]),
    /TypeError.*must be a readable stream or a function/,
    'should throw a type error when the array itemis neither a stream nor a function.'
  );

  t.throws(
    fallbackStream.bind(null, [from('a')], 'foo'),
    /TypeError.*it was string/,
    'should throw a type error when the second argument isn\'t a function/regexp/object.'
  );

  t.throws(
    fallbackStream.bind(null, [from('a')], {errorFilter: 1}),
    /TypeError.*it was number/,
    'should throw a type error when the `errorFilter` option isn\'t a regexp/function.'
  );

  t.throws(
    fallbackStream.bind(null),
    /TypeError.* is not an array.*must be an array/,
    'should throw a type error when it takes no arguments.'
  );
});
