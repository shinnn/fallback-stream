'use strict';

const fallbackStream = require('./');
const from = require('from2-array');
const test = require('tape');
const through = require('through2');

const tmpError = new Error();

function emitTmpErrorImmediately(stream) {
  process.nextTick(() => stream.emit('error', tmpError));
  return stream;
}

test('fallbackStream()', t => {
  t.plan(22);

  t.equal(fallbackStream.name, 'fallbackStream', 'must have a function name.');

  const option = {};

  fallbackStream([from('a')], option)
    .on('error', t.fail)
    .on('data', data => {
      t.equal(data.toString(), 'a', 'should create a readable stream.');
      t.deepEqual(option, {}, 'should not modify the original option object.');
    })
    .on('end', function() {
      t.deepEqual(this._errors, [], 'should set `_errors` property.');
    });

  fallbackStream([from('a'), from('b')])
    .on('error', t.fail)
    .on('data', data => t.equal(
      data.toString(),
      'a',
      'should use only the first stream when it doesn\'t emit any errors.'
    ));

  fallbackStream([from.bind(null, 'a')])
    .on('error', t.fail)
    .on('data', data => t.equal(
      data.toString(),
      'a',
      'should accept a function that returns a stream as a stream source.'
    ));

  fallbackStream([emitTmpErrorImmediately.bind(null, through())])
    .on('error', function(err) {
      t.equal(err, tmpError, 'should emit an error when the last stream emits an error.');
      t.deepEqual(
        this._errors,
        [],
        'should not push the error to the `_errors` property when it\'s actually emitted.'
      );
    });

  const willEmitError = from('');

  fallbackStream([
    willEmitError,
    from('a')
  ])
    .on('error', t.fail)
    .on('data', data => t.equal(
      data.toString(),
      'a',
      'should use the next stream as a fallback when the current stream emits an error.'
    ))
    .on('end', function() {
      t.deepEqual(
        this._errors,
        [tmpError],
        'should push the ignored errors to the `_errors` property.'
      );
    });

  willEmitError.on('error', err => {
    t.equal(err, tmpError, 'should not remove error event listeners explicitly added.');
  });
  willEmitError.emit('error', tmpError);

  const alreadyEnded = from('a');
  alreadyEnded.pipe(through());
  alreadyEnded.on('end', () => {
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
  ], err => err.message === '__does_not_match__')
    .on('error', function(err) {
      t.deepEqual(err, tmpError, 'should use a function as an error filter.');
    });

  fallbackStream([
    () => {
      const stream = through();
      process.nextTick(function() {
        stream.emit('error', new TypeError());
      });
      return stream;
    },
    () => emitTmpErrorImmediately(through()),
    through()
  ], /TypeError/)
    .on('error', err => {
      t.equal(err, tmpError, 'should use a regular expression as an error filter.');
    });

  fallbackStream([
    () => emitTmpErrorImmediately(through.obj()),
    from.obj({a: 1})
  ], {
    objectMode: true,
    errorFilter(err) {
      t.equal(err, tmpError, 'should use `errorFilter` option as an error filter.');
      return true;
    }
  })
    .on('error', t.fail)
    .on('data', data => {
      t.deepEqual(data, {a: 1}, 'should reflect readable stream options to the result.');
    });

  t.throws(
    () => fallbackStream(from('a')),
    /^TypeError.* is not an array.*must be an array/u,
    'should throw a type error when the first argument is not an array.'
  );

  t.throws(
    () => fallbackStream([() => {}]),
    /^TypeError.*must return a readable stream/u,
    'should throw a type error when the function returns a non-stream value.'
  );

  t.throws(
    () => fallbackStream([{a: 1}, null]),
    /^TypeError.*must be a readable stream or a function/u,
    'should throw a type error when the array itemis neither a stream nor a function.'
  );

  t.throws(
    () => fallbackStream([from('a')], 'foo'),
    /^TypeError.*it was string/u,
    'should throw a type error when the second argument isn\'t a function/regexp/object.'
  );

  t.throws(
    () => fallbackStream([from('a')], {errorFilter: 1}),
    /^TypeError.*it was number/u,
    'should throw a type error when the `errorFilter` option isn\'t a regexp/function.'
  );

  t.throws(
    () => fallbackStream(),
    /^TypeError.* is not an array.*must be an array/u,
    'should throw a type error when it takes no arguments.'
  );
});
