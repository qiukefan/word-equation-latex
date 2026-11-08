/* Offline image export: KaTeX MathML -> bundled MathJax SVG paths -> native PNG.
 * API: WordImageExport.svg(latex, options) / .png(latex, options)
 * Both resolve {blob, width, height}; PNG dimensions are actual raster pixels.
 * options: background ('transparent'|'white'), fontSizePt (4..96, default 12),
 *          color (#RRGGBB or #RGB, default #000000), padding (px),
 *          fontFamily (a bundled WordFormulaFonts style, default 'default'),
 *          pixelRatio (PNG only, 1..4). Legacy fontSize (px) is also accepted.
 * SVG dimensions use pt with fontSizePt; returned dimensions remain CSS px.
 * PNG resolution metadata preserves physical size at every pixelRatio.
 * No network, HTML foreignObject, or
 *          operating-system font dependency is used in the exported image.
 */
(function (root) {
  'use strict';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const MAX_DIMENSION = 8192;
  const MAX_PIXELS = 32000000;
  const INK = '#000000';

  function numberOption(value, fallback, min, max, label) {
    if (value === undefined) return fallback;
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max) throw new Error(label + '超出支持范围。');
    return number;
  }

  function readOptions(options) {
    const background = options.background === undefined ? 'transparent' : options.background;
    if (!['transparent', 'white'].includes(background)) throw new Error('请选择透明或白色图片背景。');
    const fontSizePt = options.fontSizePt !== undefined
      ? numberOption(options.fontSizePt, 12, 4, 96, '公式字号')
      : options.fontSize === undefined ? 12 : undefined;
    let color = options.color === undefined ? INK : options.color;
    if (typeof color !== 'string' || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) {
      throw new Error('公式颜色应为十六进制色值，例如 #000000。');
    }
    color = color.toLowerCase();
    if (color.length === 4) color = '#' + [...color.slice(1)].map((digit) => digit + digit).join('');
    return {
      background,
      fontFamily: root.WordFormulaFonts.get(options.fontFamily === undefined ? 'default' : options.fontFamily).id,
      fontSizePt,
      fontSize: fontSizePt === undefined ? numberOption(options.fontSize, 16, 8, 128, '公式字号') : fontSizePt * 96 / 72,
      color,
      padding: numberOption(options.padding, 16, 0, 256, '图片留白'),
      pixelRatio: numberOption(options.pixelRatio, 3, 1, 4, 'PNG 清晰度')
    };
  }

  function mathmlFromLatex(latex, fontFamily) {
    if (typeof latex !== 'string' || !latex.trim()) throw new Error('请先转换或输入需要导出的公式。');
    if (latex.length > 200000) throw new Error('公式过长，请拆分后分别导出。');
    if (!root.katex) throw new Error('公式排版组件未加载，请重新打开 HTML 文件。');
    let markup;
    try {
      markup = root.WordFormulaFonts.renderToString(latex, fontFamily, {
        output: 'mathml', displayMode: true, throwOnError: true,
        trust: false, strict: 'ignore', maxExpand: 1000, maxSize: 20
      });
    } catch (error) {
      throw new Error('公式代码存在错误，暂时无法导出图片：' + String(error.message).replace(/^KaTeX parse error:\s*/, '').slice(0, 200));
    }
    const doc = new DOMParser().parseFromString(markup, 'application/xml');
    const math = doc.querySelector('math');
    if (!math || doc.querySelector('parsererror')) throw new Error('无法读取公式结构，请检查 LaTeX 代码。');
    math.querySelectorAll('annotation,annotation-xml').forEach((node) => node.remove());
    if (math.querySelector('merror,mglyph')) throw new Error('这条公式含有无法导出为矢量图的内容。');
    // KaTeX-generated MathML is inert, but keep image export independent of URLs.
    for (const node of [math, ...math.querySelectorAll('*')]) {
      for (const attribute of [...node.attributes]) {
        if (/^(?:href|src)$/i.test(attribute.localName) || /url\s*\(/i.test(attribute.value)) {
          throw new Error('图片导出不支持外部链接或外部图像，请移除这些命令后重试。');
        }
      }
    }
    return new XMLSerializer().serializeToString(math);
  }

  function sanitizeSvg(svg, defaultColor) {
    if (svg.querySelector('[data-mjx-error],[data-mml-node="merror"]')) throw new Error('这条公式暂时无法转换为图片，请检查公式代码。');
    if (svg.querySelector('text')) {
      throw new Error('公式含有内置矢量字库暂不支持的字符（例如部分中文或特殊符号），无法保证图片一致。请改用支持的数学符号后重试。');
    }
    if (svg.querySelector('foreignObject,image,script,style,iframe')) throw new Error('这条公式含有无法独立保存的图像内容。');
    function visit(node, inheritedColor) {
      const color = node.getAttribute('color') || node.style?.getPropertyValue('color') || inheritedColor;
      for (const attribute of [...node.attributes]) {
        const name = attribute.localName, value = attribute.value;
        if (/^on/i.test(name) || /url\s*\(/i.test(value)) throw new Error('公式含有不支持的图像样式。');
        if ((name === 'href' || name === 'src') && !value.startsWith('#')) throw new Error('图片导出不允许依赖外部文件。');
        if (value.includes('currentColor')) node.setAttribute(attribute.name, value.replace(/currentColor/g, color));
        if (name.startsWith('data-') || ['class', 'tabindex', 'focusable', 'aria-hidden'].includes(name)) node.removeAttribute(attribute.name);
      }
      for (const child of [...node.children]) visit(child, color);
    }
    visit(svg, defaultColor);
    // fontCache:'none' should make every glyph a path rather than a reference.
    if (svg.querySelector('use')) throw new Error('矢量图仍包含字形引用，请重新打开 HTML 后再试。');
    if (!svg.querySelector('path,rect,line,polygon,polyline,ellipse,circle')) throw new Error('公式没有可见内容，无法导出空白图片。');
  }

  async function makeSvg(latex, options) {
    const settings = readOptions(options);
    const mathml = mathmlFromLatex(latex, settings.fontFamily);
    if (!root.MathJax?.startup?.promise) throw new Error('离线图片导出组件未加载，请重新打开 HTML 文件。');
    try { await root.MathJax.startup.promise; }
    catch { throw new Error('离线图片导出组件初始化失败，请重新打开 HTML 文件。'); }
    if (typeof root.MathJax.mathml2svg !== 'function') throw new Error('离线矢量组件不可用，请重新打开 HTML 文件。');
    let container;
    try {
      container = root.MathJax.mathml2svg(mathml, {
        display: true, em: settings.fontSize, ex: settings.fontSize / 2,
        containerWidth: 100000, scale: 1
      });
    } catch (error) {
      throw new Error('无法生成公式图片：' + String(error.message || error).slice(0, 160));
    }
    const svg = container.querySelector('svg')?.cloneNode(true);
    if (!svg) throw new Error('未生成有效的矢量公式。');
    sanitizeSvg(svg, settings.color);
    const box = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if (box.length !== 4 || box.some((value) => !Number.isFinite(value)) || box[2] <= 0 || box[3] <= 0) throw new Error('公式图片尺寸无效。');
    const pxPerUnit = settings.fontSize / 1000;
    const inset = settings.padding / pxPerUnit;
    const width = Math.ceil(box[2] * pxPerUnit + settings.padding * 2);
    const height = Math.ceil(box[3] * pxPerUnit + settings.padding * 2);
    if (width > 100000 || height > 100000) throw new Error('公式图片过大，请拆分公式后导出。');
    // Round the viewport to whole pixels, then expand the viewBox by the same
    // amount. Keeping both aspect ratios identical avoids transparent letterbox
    // strips at the edge of otherwise white SVGs, without stretching glyphs.
    const boxWidth = width / pxPerUnit;
    const boxHeight = height / pxPerUnit;
    const expandedBox = [
      box[0] - inset - (boxWidth - box[2] - inset * 2) / 2,
      box[1] - inset - (boxHeight - box[3] - inset * 2) / 2,
      boxWidth,
      boxHeight
    ];
    svg.removeAttribute('style');
    svg.setAttribute('xmlns', SVG_NS);
    svg.setAttribute('width', settings.fontSizePt === undefined ? String(width) : width * 72 / 96 + 'pt');
    svg.setAttribute('height', settings.fontSizePt === undefined ? String(height) : height * 72 / 96 + 'pt');
    svg.setAttribute('viewBox', expandedBox.join(' '));
    svg.setAttribute('color', settings.color);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', '数学公式');
    if (settings.background === 'white') {
      const background = document.createElementNS(SVG_NS, 'rect');
      ['x', 'y', 'width', 'height'].forEach((name, i) => background.setAttribute(name, String(expandedBox[i])));
      background.setAttribute('fill', '#ffffff');
      svg.insertBefore(background, svg.firstChild);
    }
    const serialized = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
    return {blob: new Blob([serialized], {type: 'image/svg+xml;charset=utf-8'}), width, height};
  }

  async function svg(latex, options = {}) { return makeSvg(latex, options); }

  function pngCrc(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  async function withPngResolution(blob, dpi) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length < 8 || signature.some((byte, index) => bytes[index] !== byte)) {
      throw new Error('浏览器生成的 PNG 格式无效，请改用 SVG 导出。');
    }
    // pHYs stores pixels per metre, with unit 1. The CRC covers type + data,
    // not the length, and all integer fields use PNG's big-endian byte order.
    const resolution = new Uint8Array(21);
    const resolutionView = new DataView(resolution.buffer);
    resolutionView.setUint32(0, 9);
    resolution.set([112, 72, 89, 115], 4); // pHYs
    const pixelsPerMetre = Math.round(dpi / 0.0254);
    resolutionView.setUint32(8, pixelsPerMetre);
    resolutionView.setUint32(12, pixelsPerMetre);
    resolution[16] = 1;
    resolutionView.setUint32(17, pngCrc(resolution.subarray(4, 17)));

    const parts = [bytes.subarray(0, 8)];
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 8, inserted = false, ended = false;
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset);
      const end = offset + length + 12;
      if (end > bytes.length) break;
      const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
      if (offset === 8 && (type !== 'IHDR' || length !== 13)) break;
      if (type === 'IDAT' && !inserted) { parts.push(resolution); inserted = true; }
      // Replace browser-provided resolution rather than leaving duplicate chunks.
      if (type !== 'pHYs') parts.push(bytes.subarray(offset, end));
      offset = end;
      if (type === 'IEND') { ended = length === 0; break; }
    }
    if (!inserted || !ended || offset !== bytes.length) {
      throw new Error('无法写入 PNG 分辨率，请改用 SVG 导出。');
    }
    return new Blob(parts, {type: 'image/png'});
  }

  async function png(latex, options = {}) {
    const settings = readOptions(options);
    const vector = await makeSvg(latex, settings);
    const width = Math.ceil(vector.width * settings.pixelRatio);
    const height = Math.ceil(vector.height * settings.pixelRatio);
    if (width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) {
      throw new Error('PNG 尺寸过大，请降低清晰度或拆分公式；也可以导出 SVG。');
    }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器无法创建图片画布，请改用 SVG 导出。');
    const url = URL.createObjectURL(vector.blob);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('浏览器无法读取生成的矢量图，请改用 SVG 导出。'));
        image.src = url;
      });
      if (settings.background === 'white') { context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height); }
      context.drawImage(image, 0, 0, width, height);
      const blob = await new Promise((resolve, reject) => {
        try { canvas.toBlob((result) => result ? resolve(result) : reject(new Error('PNG 生成失败，请改用 SVG 导出。')), 'image/png'); }
        catch { reject(new Error('浏览器无法保存 PNG，请改用 SVG 导出。')); }
      });
      return {blob: await withPngResolution(blob, 96 * settings.pixelRatio), width, height};
    } finally { URL.revokeObjectURL(url); canvas.width = 0; canvas.height = 0; }
  }

  root.WordImageExport = Object.freeze({svg, png});
})(window);
