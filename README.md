# msgpack-implementation

A lightweight MessagePack encoder/decoder tailored for MooMoo packets.

## Features

- Supports nil, booleans, positive/negative fixints, int8/16/32, uint8/16/32, float64
- Handles fixstr, str8, str16
- Works with fixarray, array16, array32, and corresponding maps

## Installation

Clone the repository and install dependencies (none required):

```sh
npm install
```

## Usage

```js
const { encode, decode } = require('msgpack-implementation');

const encoded = encode({ foo: 'bar', nums: [1, 2, 3] });
const decoded = decode(encoded);
console.log(decoded);
```

## Testing

Run a basic roundtrip test suite:

```sh
npm test
```

## License

MIT
