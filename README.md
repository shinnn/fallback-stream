# fallback-stream

[![npm version](https://img.shields.io/npm/v/fallback-stream.svg)](https://www.npmjs.com/package/fallback-stream)
[![Build Status](https://travis-ci.com/shinnn/fallback-stream.svg?branch=master)](https://travis-ci.com/shinnn/fallback-stream)
[![Coverage Status](https://img.shields.io/coveralls/shinnn/fallback-stream.svg?style=flat)](https://coveralls.io/github/shinnn/fallback-stream)

Create a [`Readable` stream](https://nodejs.org/api/stream.html#stream_readable_streams) that switches to the fallback on error

```javascript
const {createReadStream} = require('fs');
const fallbackStream = require('fallback-stream');

fallbackStream([
  createReadStream('foo.txt'), // foo.txt doesn't exist
  createReadStream('bar.txt'), // bar.txt: 'Hello!'
  createReadStream('baz.txt')  // baz.txt doesn't exist
])
  .pipe(process.stdout); // yields 'Hello!'
```

## Installation

[Use](https://docs.npmjs.com/cli/install) [npm](https://docs.npmjs.com/about-npm/).

```
npm install fallback-stream
```

## API

```javascript
const fallbackStream = require('fallback-stream');
```

### stream = fallbackStream(*array* [, *options*])

*array*: `Array` (directly passed to [multistream](https://github.com/feross/multistream#usage))  
*options*: `Object | Function | RegExp`  
Return: [`stream.Readable`](https://nodejs.org/api/stream.html#stream_class_stream_readable)

When the first stream emits an error, the next one starts, and so on until one of the streams ends successfully. In other words, when the one of the streams ended, the rest won't be used.

```javascript
const firstStream = fs.createReadStream('path/to/file/foo');
const fallback = fs.createReadStream('path/to/file/bar');

// a function that returns a readable stream
const fallbackFn = () => fs.createReadStream('path/to/file/baz');

fallbackStream([
  firstStream,
  fallback,
  fallbackFn
]);
```

#### options

It supports [`stream.Readable`](https://nodejs.org/api/stream.html#stream_new_stream_readable_options) options and the following:

##### errorFilter

Type: `Function | RegExp`  
Default: `function() { return true }`

Filter errors that streams emit. If the filtering result is falsy, the created stream emits an error immediately and won't use the rest of streams.

```javascript
function createErrorStream(err) {
  const stream = new stream.PassThrough();
  process.nextTick(() => stream.emit('error', err));
  return stream;
}

createStreams = function() {
  return [
    createErrorStream(new TypeError()),
    createErrorStream(new RangeError()),
    createErrorStream(new SyntaxError())
  ];
}

fallbackStream(createStreams(), {}).on('error', err => {
  err.name; //=> 'SyntaxError'
});

fallbackStream(createStreams(), {
  errorFilter(err) {
    return err.name === 'RangeError';
  }
}).on('error', err => {
  err.name; //=> 'TypeError'
});

fallbackStream(createStreams(), {
  errorFilter: /TypeError/
}).on('error', err => {
  err.name; //=> 'RangeError'
});
```

You can directly pass a `Function` or `RegExp` to the second argument to specify the error filter simply, instead of passing an object.

```javascript
fallbackStream([/* streams */], /ENOENT/);
```

#### stream.\_errors

Type: `Error[]`  
Default: `[]`

The `Error`s that streams were supposed to emit but didn't.

## License

Copyright (c) [Shinnosuke Watanabe](https://github.com/shinnn)

Licensed under [the MIT License](./LICENSE).
