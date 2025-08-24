const assert = require('assert');
const { encode, decode } = require('..');

const values = [
  null,
  true,
  false,
  0,
  1,
  -1,
  255,
  -128,
  65535,
  -32768,
  1.5,
  'hello',
  [1, 2, 3],
  { a: 1, b: 'hi' }
];

for (const val of values) {
  const encoded = encode(val);
  const decoded = decode(encoded);
  assert.deepStrictEqual(decoded, val);
}

console.log('All roundtrip tests passed!');
