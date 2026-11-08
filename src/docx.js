/* WordDocx.extract(File | ArrayBuffer | Uint8Array) -> Promise<{parts, warnings}>
 * Local-only DOCX XML reader. Requires the bundled fflate.inflateSync function.
 * Reads the ZIP central directory itself, never inflating unrelated media.
 */
(function (root) {
  'use strict';
  const MAX_FILE = 30 * 1024 * 1024;
  const MAX_XML = 20 * 1024 * 1024;
  const selectedName = /^word\/(?:document|footnotes|endnotes|header\d*|footer\d*)\.xml$/;
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  const invalid = () => new Error('这个文件不是完整的 DOCX 文档，或 ZIP 结构已损坏。请在 Word 中重新另存为 .docx 后导入。');
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function rank(name) {
    if (name === 'word/document.xml') return 0;
    if (name === 'word/footnotes.xml') return 1;
    if (name === 'word/endnotes.xml') return 2;
    return name.includes('/header') ? 3 : 4;
  }
  function decodeXML(bytes) {
    let encoding = 'utf-8';
    if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le';
    else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be';
    else if (bytes[0] === 0x3c && bytes[1] === 0) encoding = 'utf-16le';
    else if (bytes[0] === 0 && bytes[1] === 0x3c) encoding = 'utf-16be';
    try { return new TextDecoder(encoding, {fatal: true}).decode(bytes); }
    catch (_) { throw new Error('文档中的 XML 文本编码无法读取。请在 Word 中重新另存为 .docx。'); }
  }
  async function extract(input) {
    if (input && typeof input.size === 'number' && input.size > MAX_FILE) {
      throw new Error('文档超过 30 MB。请将需要转换的公式另存到较小的 .docx 文档。');
    }
    let bytes;
    if (input instanceof Uint8Array) bytes = input;
    else if (input instanceof ArrayBuffer) bytes = new Uint8Array(input);
    else if (input && typeof input.arrayBuffer === 'function') bytes = new Uint8Array(await input.arrayBuffer());
    else throw new Error('请选择 .docx 格式的 Word 文档。');
    if (bytes.byteLength > MAX_FILE) throw new Error('文档超过 30 MB。请将需要转换的公式另存到较小的 .docx 文档。');
    if (bytes.byteLength < 22) throw invalid();
    if (bytes[0] === 0xd0 && bytes[1] === 0xcf) {
      throw new Error('无法读取旧版 .doc 文件或加密文档。请在 Word 中另存为不带密码的 .docx 文件。');
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const range = (offset, length) => {
      if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > bytes.length) throw invalid();
    };
    const u16 = offset => { range(offset, 2); return view.getUint16(offset, true); };
    const u32 = offset => { range(offset, 4); return view.getUint32(offset, true); };
    let end = -1;
    for (let i = bytes.length - 22, min = Math.max(0, bytes.length - 22 - 65535); i >= min; i--) {
      if (u32(i) === 0x06054b50 && i + 22 + u16(i + 20) === bytes.length) { end = i; break; }
    }
    if (end < 0) throw invalid();
    const count = u16(end + 10), directorySize = u32(end + 12), directoryOffset = u32(end + 16);
    if (count === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff || (end >= 20 && u32(end - 20) === 0x07064b50)) {
      throw new Error('暂不支持 ZIP64 格式的文档。请在 Word 中将公式另存为普通 .docx 文件。');
    }
    if (u16(end + 4) !== 0 || u16(end + 6) !== 0 || u16(end + 8) !== count) throw new Error('暂不支持分卷压缩的文档。请选择普通 .docx 文件。');
    range(directoryOffset, directorySize);
    if (directoryOffset + directorySize > end || count > 20000) throw invalid();
    let cursor = directoryOffset, totalXML = 0;
    const entries = [], seen = new Set();
    const decoder = new TextDecoder('utf-8', {fatal: true});
    for (let index = 0; index < count; index++) {
      range(cursor, 46);
      if (u32(cursor) !== 0x02014b50) throw invalid();
      const flags = u16(cursor + 8), method = u16(cursor + 10), crc = u32(cursor + 16);
      const compressedSize = u32(cursor + 20), size = u32(cursor + 24);
      const nameLength = u16(cursor + 28), extraLength = u16(cursor + 30), commentLength = u16(cursor + 32);
      const disk = u16(cursor + 34), offset = u32(cursor + 42);
      if (compressedSize === 0xffffffff || size === 0xffffffff || offset === 0xffffffff || disk === 0xffff) throw new Error('暂不支持 ZIP64 格式的文档。请在 Word 中重新另存为普通 .docx。');
      if (disk !== 0) throw new Error('暂不支持分卷压缩的文档。');
      range(cursor + 46, nameLength + extraLength + commentLength);
      if (cursor + 46 + nameLength + extraLength + commentLength > directoryOffset + directorySize) throw invalid();
      let name;
      try { name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength)); }
      catch (_) { name = ''; } // Non-UTF-8 media filenames are irrelevant to native Word math.
      if (selectedName.test(name)) {
        if (seen.has(name)) throw invalid();
        seen.add(name);
        if (flags & 1 || flags & 64) throw new Error('无法读取加密的 Word 文档。请移除打开密码后另存为 .docx。');
        if (method !== 0 && method !== 8) throw new Error('文档使用了暂不支持的压缩方式。请在 Word 中重新另存为 .docx。');
        totalXML += size;
        if (totalXML > MAX_XML) throw new Error('文档正文过大（超过 20 MB）。请将需要转换的公式另存为一个较小的文档。');
        entries.push({name, flags, method, crc, compressedSize, size, offset});
      }
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    if (cursor !== directoryOffset + directorySize || !seen.has('word/document.xml')) throw invalid();
    entries.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, undefined, {numeric: true}));
    const parts = [];
    for (const entry of entries) {
      range(entry.offset, 30);
      if (u32(entry.offset) !== 0x04034b50 || u16(entry.offset + 6) !== entry.flags || u16(entry.offset + 8) !== entry.method) throw invalid();
      const nameLength = u16(entry.offset + 26), extraLength = u16(entry.offset + 28);
      range(entry.offset + 30, nameLength + extraLength);
      let localName;
      try { localName = decoder.decode(bytes.subarray(entry.offset + 30, entry.offset + 30 + nameLength)); }
      catch (_) { throw invalid(); }
      if (localName !== entry.name) throw invalid();
      const start = entry.offset + 30 + nameLength + extraLength;
      range(start, entry.compressedSize);
      if (start + entry.compressedSize > directoryOffset) throw invalid();
      const compressed = bytes.subarray(start, start + entry.compressedSize);
      let expanded;
      if (entry.method === 0) expanded = compressed;
      else {
        if (!root.fflate || typeof root.fflate.inflateSync !== 'function') throw new Error('文档解压组件未加载。请重新打开 HTML 应用。');
        try { expanded = root.fflate.inflateSync(compressed, {out: new Uint8Array(entry.size)}); }
        catch (_) { throw invalid(); }
      }
      if (expanded.length !== entry.size || crc32(expanded) !== entry.crc) throw invalid();
      const xml = decodeXML(expanded);
      if (/<!DOCTYPE\b/i.test(xml)) throw new Error('文档包含不支持的 XML 文档类型声明。请在 Word 中重新另存为 .docx。');
      parts.push({name: entry.name, xml});
    }
    return {parts, warnings: []};
  }
  root.WordDocx = {extract};
})(typeof window !== 'undefined' ? window : globalThis);
