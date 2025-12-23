// src/polyfills.js
import { Buffer } from 'buffer';

// Standard polyfill
globalThis.Buffer = globalThis.Buffer || Buffer;

// Fix for missing prototype methods (this is what breaks 'size' and deserialization)
Buffer.prototype.subarray = function subarray(begin, end) {
  const result = Uint8Array.prototype.subarray.call(this, begin, end);
  Object.setPrototypeOf(result, Buffer.prototype);
  return result;
};