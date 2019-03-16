'use strict';

const fallbackStream = require('.');
const {PassThrough, Readable} = require('stream');
const test = require('tape');
const toReadableStream = require('to-readable-stream');

const tmpError = new Error('tmp error');

function emitTmpErrorImmediately(stream) {
	process.nextTick(() => stream.emit('error', tmpError));
	return stream;
}

test('fallbackStream()', t => {
	t.plan(15);

	const option = {};

	fallbackStream([toReadableStream('a')], option)
	.on('error', t.fail)
	.on('data', data => {
		t.equal(data.toString(), 'a', 'should create a readable stream.');
		t.deepEqual(option, {}, 'should not modify the original option object.');
	})
	.on('end', function() {
		t.deepEqual(
			this._errors, // eslint-disable-line no-underscore-dangle
			[],
			'should set `_errors` property.'
		);
	});

	fallbackStream([toReadableStream('a'), toReadableStream('b')])
	.on('error', t.fail)
	.on('data', data => t.equal(
		data.toString(),
		'a',
		'should use only the first stream when it doesn\'t emit any errors.'
	));

	fallbackStream([() => toReadableStream('a')])
	.on('error', t.fail)
	.on('data', data => t.equal(
		data.toString(),
		'a',
		'should accept a function that returns a stream as a stream source.'
	));

	fallbackStream([() => emitTmpErrorImmediately(new PassThrough())])
	.on('error', function(err) {
		t.equal(err, tmpError, 'should emit an error when the last stream emits an error.');
		t.deepEqual(
			this._errors, // eslint-disable-line no-underscore-dangle
			[],
			'should not push the error to the `_errors` property when it\'s actually emitted.'
		);
	});

	const willEmitError = toReadableStream('');

	fallbackStream([
		willEmitError,
		toReadableStream('a')
	])
	.on('error', t.fail)
	.on('data', data => t.equal(
		data.toString(),
		'a',
		'should use the next stream as a fallback when the current stream emits an error.'
	))
	.on('end', function() {
		t.deepEqual(
			this._errors, // eslint-disable-line no-underscore-dangle
			[tmpError],
			'should push the ignored errors to the `_errors` property.'
		);
	});

	willEmitError.on('error', err => t.equal(
		err,
		tmpError,
		'should not remove error event listeners explicitly added.'
	));
	willEmitError.emit('error', tmpError);

	toReadableStream('a').on('end', function() {
		fallbackStream([this, toReadableStream('b')], null)
		.on('data', t.notOk)
		.on('error', t.fail);

		t.ok(
			this._readableState.ended, // eslint-disable-line no-underscore-dangle
			'should stop fallback when the stream have already ended.'
		);
	}).pipe(new PassThrough());

	fallbackStream([
		() => emitTmpErrorImmediately(new PassThrough()),
		new PassThrough()
	], err => err.message === '__does_not_match__')
	.on('error', err => {
		t.deepEqual(
			err,
			tmpError,
			'should use a function as an error filter.'
		);
	});

	fallbackStream([
		() => new Readable({
			read() {
				process.nextTick(() => this.emit('error', new TypeError('error')));
			}
		}),
		() => emitTmpErrorImmediately(new PassThrough()),
		new PassThrough()
	], /TypeError/u)
	.on('error', err => {
		t.equal(
			err,
			tmpError,
			'should use a regular expression as an error filter.'
		);
	});

	fallbackStream([
		() => emitTmpErrorImmediately(new PassThrough({objectMode: true})),
		new Readable({
			objectMode: true,
			read() {
				this.push({a: 1});
				this.push(null);
			}
		})
	], {
		objectMode: true,
		errorFilter(err) {
			t.equal(
				err,
				tmpError,
				'should use `errorFilter` option as an error filter.'
			);

			return true;
		}
	})
	.on('error', t.fail)
	.on('data', data => {
		t.deepEqual(
			data,
			{a: 1},
			'should reflect readable stream options to the result.'
		);
	});
});

test('Argument validation', t => {
	t.throws(
		() => fallbackStream(toReadableStream('a')),
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
		() => fallbackStream([toReadableStream('a')], 'foo'),
		/^TypeError.*it was string/u,
		'should throw a type error when the second argument isn\'t a function/regexp/object.'
	);

	t.throws(
		() => fallbackStream([toReadableStream('a')], {errorFilter: 1}),
		/^TypeError.*it was number/u,
		'should throw a type error when the `errorFilter` option isn\'t a regexp/function.'
	);

	t.throws(
		() => fallbackStream(),
		/^TypeError.* is not an array.*must be an array/u,
		'should throw a type error when it takes no arguments.'
	);

	t.end();
});
