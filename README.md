# fallback-stream

[![Build Status](https://img.shields.io/travis/shinnn/fallback-stream.svg?style=flat)](https://travis-ci.org/shinnn/fallback-stream)
[![Build status](https://ci.appveyor.com/api/projects/status/n77lgth2o31tm4v5?svg=true)](https://ci.appveyor.com/project/ShinnosukeWatanabe/fallback-stream)
[![Coverage Status](https://img.shields.io/coveralls/shinnn/fallback-stream.svg?style=flat)](https://coveralls.io/r/shinnn/fallback-stream)
[![Dependency Status](https://david-dm.org/shinnn/fallback-stream.svg?style=flat)](https://david-dm.org/shinnn/fallback-stream)
[![devDependency Status](https://david-dm.org/shinnn/fallback-stream/dev-status.svg?style=flat)](https://david-dm.org/shinnn/fallback-stream#info=devDependencies)

Create a readable stream that swithes to the fallback on error

```javascript
var fs = require('fs');
var fallbackStream = require('fallback-stream');

fallbackStream([
  fs.createReadStream('foo.txt'), // foo.txt doesn't exist
  fs.createReadStream('bar.txt'), // bar.txt: 'Hello!'
  fs.createReadStream('baz.txt')  // baz.txt doesn't exist
])
  .pipe(process.stdout); // yields 'Hello!'
```

## Installation

[![NPM version](https://img.shields.io/npm/v/fallback-stream.svg?style=flat)](https://www.npmjs.com/package/fallback-stream)

[Use npm.](https://docs.npmjs.com/cli/install)

```
npm install fallback-stream
```

## API

```javascript
var fallbackStream = require('fallback-stream');
```

### stream = fallbackStream(*array*, [, *options*])

*array*: `Array` (directly passed to [multistream](https://github.com/feross/multistream#usage))  
*options*: `Object`, `Function` or `RegExp`  
Return: `Object` ([stream.Readable])

It returns a readable stream. When the first stream emits an error, the next one starts, and so on until one of the streams ends successfully. In other words, when the one of the streams ended, the rest won't be used.

```javascript
var fs = require('fs');
var fallbackStream = require('fallback-stream');

var firstStream = fs.createReadStream('path/to/file/foo');

var fallback = fs.createReadStream('path/to/file/bar');

// a function that returns a readable stream
var fallbackFn = function() {
  return fs.createReadStream('path/to/file/baz');
};

fallbackStream([
  firstStream,
  fallback,
  fallbackFn
]);
```

#### options

The option object will be directly passed to [`stream.Readable`](http://nodejs.org/api/stream.html#stream_new_stream_readable_options) options.

Additionally, *fallback-stream* accepts [`errorFilter` option](#optionserrorfilter).

##### options.errorFilter

Type: `Function` or `RegExp`  
Default: `function() { return true }`

Filter errors that streams emit. If the filtering result is falsy, the created stream emits an error immediately and won't use the rest of streams.

```javascript
var fallbackStream = require('fallback-stream');
var through = require('through2'); // npm install through2

function createErrorStream(err) {
  var stream = through();
  process.nextTick(function() {
    stream.emit('error', err);
  });
  return stream;
}


createStreams = function() {
  return [
    createErrorStream(new TypeError()),
    createErrorStream(new RangeError()),
    createErrorStream(new SyntaxError())
  ];
}

fallbackStream(createStreams(), {}).on('error', function(err) {
  err.name; //=> 'SyntaxError'
});

fallbackStream(createStreams(), {
  errorFilter: function(err) {
    return err.name === 'RangeError';
  }
}).on('error', function(err) {
  err.name; //=> 'TypeError'
});

fallbackStream(createStreams(), {
  errorFilter: /TypeError/
}).on('error', function(err) {
  err.name; //=> 'RangeError'
});
```

You can directly pass a `Function` or `RegExp` to the second argument to specify the error filter simply, instead of passing an object.

```javascript
fallbackStream([/* streams */], /ENOENT/);
```

#### stream._errors

Type: `Array`  
Default: `[]`

The errors that streams were supposed to emit but didn't.
 
## License

Copyright (c) 2014 [Shinnosuke Watanabe](https://github.com/shinnn)

Licensed under [the MIT License](./LICENSE).

[stream.Readable]: http://nodejs.org/api/stream.html#stream_class_stream_readable
