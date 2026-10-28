// Minimal ZIP writer/reader with no dependencies (window.MiniZip).
// Writes uncompressed ("stored") entries; reads stored and deflated entries
// using the browser's built-in DecompressionStream.
(function () {
  var table = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = table[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function toBytes(data) {
    if (data instanceof Uint8Array) return Promise.resolve(data);
    if (data instanceof Blob) return data.arrayBuffer().then(function (b) { return new Uint8Array(b); });
    return Promise.resolve(new TextEncoder().encode(String(data)));
  }
  function dosTime(d) { return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() }; }

  function ZipWriter() { this.entries = []; }
  ZipWriter.prototype.file = function (name, data, opts) {
    if (opts && opts.base64) { var bin = atob(data), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); data = u; }
    this.entries.push({ name: name, data: data });
    return this;
  };
  ZipWriter.prototype.names = function () { return this.entries.map(function (e) { return e.name; }); };
  ZipWriter.prototype.generate = function () {
    var entries = this.entries, t = dosTime(new Date());
    return Promise.all(entries.map(function (e) { return toBytes(e.data); })).then(function (datas) {
      var parts = [], central = [], offset = 0;
      entries.forEach(function (e, i) {
        var name = new TextEncoder().encode(e.name), data = datas[i], crc = crc32(data);
        var lh = new DataView(new ArrayBuffer(30));
        lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
        lh.setUint16(10, t.time, true); lh.setUint16(12, t.date, true); lh.setUint32(14, crc, true);
        lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
        parts.push(new Uint8Array(lh.buffer), name, data);
        var ch = new DataView(new ArrayBuffer(46));
        ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
        ch.setUint16(12, t.time, true); ch.setUint16(14, t.date, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
        ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
        central.push(new Uint8Array(ch.buffer), name);
        offset += 30 + name.length + data.length;
      });
      var size = central.reduce(function (n, p) { return n + p.length; }, 0);
      var end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true); end.setUint32(12, size, true); end.setUint32(16, offset, true);
      return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/zip' });
    });
  };

  // Returns [{ name, blob() , text() }] for every file in the zip.
  function read(blob) {
    return blob.arrayBuffer().then(function (buf) {
      var v = new DataView(buf), u8 = new Uint8Array(buf), eocd = -1;
      for (var i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
      if (eocd < 0) throw new Error('That file isn’t a zip.');
      var count = v.getUint16(eocd + 10, true), p = v.getUint32(eocd + 16, true), out = [];
      for (var n = 0; n < count; n++) {
        var method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true), nlen = v.getUint16(p + 28, true), xlen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true), lho = v.getUint32(p + 42, true);
        var name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
        var start = lho + 30 + v.getUint16(lho + 26, true) + v.getUint16(lho + 28, true);
        (function (name, method, raw) {
          var get = function () {
            if (method === 0) return Promise.resolve(new Blob([raw]));
            if (method === 8 && window.DecompressionStream) return new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
            return Promise.reject(new Error('Unsupported zip compression in ' + name));
          };
          if (!/\/$/.test(name)) out.push({ name: name, blob: get, text: function () { return get().then(function (b) { return b.text(); }); } });
        })(name, method, u8.slice(start, start + csize));
        p += 46 + nlen + xlen + clen;
      }
      return out;
    });
  }

  window.MiniZip = { create: function () { return new ZipWriter(); }, read: read };
})();
