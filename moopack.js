// mini-moo-msgpack.js — lightweight msgpack for MooMoo packets
// API: miniMooMsgpack.decode(Uint8Array|ArrayBuffer) -> value
//      miniMooMsgpack.encode(value) -> Uint8Array
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.miniMooMsgpack = factory();
})(this, function () {

  // -------- utils --------
  function u8view(x) {
    if (x instanceof Uint8Array) return x;
    if (x instanceof ArrayBuffer) return new Uint8Array(x);
    if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
    throw new TypeError("expected ArrayBuffer/Uint8Array");
  }

  // -------- Decoder --------
  function D(buf) {
    this.u8 = u8view(buf);
    this.v = new DataView(this.u8.buffer, this.u8.byteOffset, this.u8.byteLength);
    this.i = 0;
  }
  D.prototype.u8_  = function () { return this.u8[this.i++]; };
  D.prototype.u16  = function () { const v = this.v.getUint16(this.i); this.i += 2; return v; };
  D.prototype.u32  = function () { const v = this.v.getUint32(this.i); this.i += 4; return v; };
  D.prototype.i8   = function () { const v = this.v.getInt8(this.i);  this.i += 1; return v; };
  D.prototype.i16  = function () { const v = this.v.getInt16(this.i); this.i += 2; return v; };
  D.prototype.i32  = function () { const v = this.v.getInt32(this.i); this.i += 4; return v; };
  D.prototype.f32  = function () { const v = this.v.getFloat32(this.i); this.i += 4; return v; };
  D.prototype.f64  = function () { const v = this.v.getFloat64(this.i); this.i += 8; return v; };

  function decode(input) {
    const d = new D(input);
    const val = read(d);
    return val;
  }

  function read(d) {
    const b = d.u8_();

    // positive fixint
    if (b <= 0x7f) return b;
    // fixmap
    if ((b & 0xf0) === 0x80) return readMap(d, b & 0x0f);
    // fixarray
    if ((b & 0xf0) === 0x90) return readArray(d, b & 0x0f);
    // fixstr
    if ((b & 0xe0) === 0xa0) return readStr(d, b & 0x1f);

    switch (b) {
      case 0xc0: return null;
      case 0xc2: return false;
      case 0xc3: return true;

      case 0xca: return d.f32(); // float32
      case 0xcb: return d.f64(); // float64

      case 0xcc: return d.u8_();
      case 0xcd: return d.u16();
      case 0xce: return d.u32();

      case 0xd0: return d.i8();
      case 0xd1: return d.i16();
      case 0xd2: return d.i32();

      case 0xd9: return readStr(d, d.u8_());
      case 0xda: return readStr(d, d.u16());

      case 0xdc: return readArray(d, d.u16());
      case 0xdd: return readArray(d, d.u32());

      case 0xde: return readMap(d, d.u16());
      case 0xdf: return readMap(d, d.u32());

      default:
        // negative fixint
        if (b >= 0xe0) return (b << 24) >> 24;
        throw new Error("unsupported type 0x" + b.toString(16));
    }
  }

  function readStr(d, len) {
    const start = d.i;
    d.i += len;
    if (typeof TextDecoder !== "undefined") {
      return new TextDecoder("utf-8").decode(d.u8.subarray(start, start + len));
    }
    let out = "";
    for (let i = 0; i < len; i++) out += String.fromCharCode(d.u8[start + i]);
    try { return decodeURIComponent(escape(out)); } catch { return out; }
  }

  function readArray(d, len) {
    const a = new Array(len);
    for (let i = 0; i < len; i++) a[i] = read(d);
    return a;
  }

  function readMap(d, len) {
    const o = {};
    for (let i = 0; i < len; i++) {
      const k = read(d);
      o[k] = read(d);
    }
    return o;
  }

  // -------- Encoder --------
  function E(sizeHint) {
    const cap = sizeHint || 256;
    this.buf = new Uint8Array(cap);
    this.v = new DataView(this.buf.buffer);
    this.i = 0;
  }
  E.prototype.ensure = function (n) {
    if (this.i + n <= this.buf.length) return;
    const nb = new Uint8Array(Math.max(this.buf.length * 2, this.i + n));
    nb.set(this.buf);
    this.buf = nb;
    this.v = new DataView(nb.buffer);
  };
  E.prototype.putU8  = function (b) { this.ensure(1); this.buf[this.i++] = b; };
  E.prototype.putU16 = function (v) { this.ensure(2); this.v.setUint16(this.i, v); this.i += 2; };
  E.prototype.putU32 = function (v) { this.ensure(4); this.v.setUint32(this.i, v); this.i += 4; };
  E.prototype.putI8  = function (v) { this.ensure(1); this.v.setInt8(this.i, v);  this.i += 1; };
  E.prototype.putI16 = function (v) { this.ensure(2); this.v.setInt16(this.i, v); this.i += 2; };
  E.prototype.putI32 = function (v) { this.ensure(4); this.v.setInt32(this.i, v); this.i += 4; };
  E.prototype.putF32 = function (v) { this.ensure(4); this.v.setFloat32(this.i, v); this.i += 4; };
  E.prototype.putF64 = function (v) { this.ensure(8); this.v.setFloat64(this.i, v); this.i += 8; };
  E.prototype.putU8a = function (arr) { this.ensure(arr.length); this.buf.set(arr, this.i); this.i += arr.length; };

  function encode(x) {
    const e = new E();
    write(e, x, 0);
    return e.buf.slice(0, e.i);
  }

  function write(e, x, depth) {
    if (x === null || x === undefined) { e.putU8(0xc0); return; }
    const t = typeof x;
    if (t === "boolean") { e.putU8(x ? 0xc3 : 0xc2); return; }
    if (t === "number") {
      if (Number.isInteger(x) && x >= -2147483648 && x <= 4294967295) {
        if (x >= 0) {
          if (x < 0x80) { e.putU8(x); return; }
          if (x < 0x100) { e.putU8(0xcc); e.putU8(x); return; }
          if (x < 0x10000) { e.putU8(0xcd); e.putU16(x); return; }
          e.putU8(0xce); e.putU32(x); return;
        } else {
          if (x >= -32) { e.putU8(0xe0 | (x + 32)); return; }
          if (x >= -128) { e.putU8(0xd0); e.putI8(x); return; }
          if (x >= -32768) { e.putU8(0xd1); e.putI16(x); return; }
          e.putU8(0xd2); e.putI32(x); return;
        }
      }
      // default to float64 to match MooMoo
      e.putU8(0xcb); e.putF64(x); return;
    }
    if (t === "string") {
      const enc = (typeof TextEncoder !== "undefined") ? new TextEncoder().encode(x) : strToU8(x);
      const n = enc.length;
      if (n < 32) { e.putU8(0xa0 | n); e.putU8a(enc); return; }
      if (n < 0x100) { e.putU8(0xd9); e.putU8(n); e.putU8a(enc); return; }
      e.putU8(0xda); e.putU16(n); e.putU8a(enc); return;
    }
    if (Array.isArray(x)) {
      const n = x.length;
      if (n < 16) { e.putU8(0x90 | n); }
      else if (n < 0x10000) { e.putU8(0xdc); e.putU16(n); }
      else { e.putU8(0xdd); e.putU32(n); }
      for (let i = 0; i < n; i++) write(e, x[i], depth + 1);
      return;
    }
    if (t === "object") { // map
      const keys = Object.keys(x);
      const n = keys.length;
      if (n < 16) { e.putU8(0x80 | n); }
      else if (n < 0x10000) { e.putU8(0xde); e.putU16(n); }
      else { e.putU8(0xdf); e.putU32(n); }
      for (let i = 0; i < n; i++) {
        write(e, keys[i], depth + 1);
        write(e, x[keys[i]], depth + 1);
      }
      return;
    }
    throw new Error("unsupported type: " + t);
  }

  function strToU8(s) {
    const arr = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i) & 0xff;
    return arr;
  }

  return { decode, encode };
});
