(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const t = (message, values) => WordI18n.t(message, values);
  const state = { source: '', kind: 'auto', equations: [], index: 0, format: '', busy: false, version: 0, previewScale: 1, previewExpanded: false, imageExporting: false, fontFamily: 'default', fontSizePt: 12, formulaColor: '#000000', styleValid: true, importSummary: '', importInfo: null, lastImageExport: null };
  const samples = {
    fraction: '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi><mo>=</mo><mfrac><mrow><mo>−</mo><mi>b</mi><mo>±</mo><msqrt><mrow><msup><mi>b</mi><mn>2</mn></msup><mo>−</mo><mn>4</mn><mi>a</mi><mi>c</mi></mrow></msqrt></mrow><mrow><mn>2</mn><mi>a</mi></mrow></mfrac></math>',
    integral: '<math xmlns="http://www.w3.org/1998/Math/MathML"><msubsup><mo>∫</mo><mn>0</mn><mi>∞</mi></msubsup><msup><mi>e</mi><mrow><mo>−</mo><msup><mi>x</mi><mn>2</mn></msup></mrow></msup><mi>d</mi><mi>x</mi><mo>=</mo><mfrac><msqrt><mi>π</mi></msqrt><mn>2</mn></mfrac></math>',
    matrix: '<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><m:r><m:t>A=</m:t></m:r><m:d><m:dPr><m:begChr m:val="["/><m:endChr m:val="]"/></m:dPr><m:e><m:m><m:mr><m:e><m:r><m:t>a</m:t></m:r></m:e><m:e><m:r><m:t>b</m:t></m:r></m:e></m:mr><m:mr><m:e><m:r><m:t>c</m:t></m:r></m:e><m:e><m:r><m:t>d</m:t></m:r></m:e></m:mr></m:m></m:e></m:d></m:oMath>'
  };
  function status(message, level = '') { state.statusRenderer = typeof message === 'function' ? message : null; $('status').textContent = state.statusRenderer ? state.statusRenderer() : t(message); $('status').className = 'status ' + level; }
  function warnings(messages = []) {
    $('warnings').replaceChildren();
    [...new Set(messages)].forEach((message) => { const li = document.createElement('li'); li.textContent = t(message); $('warnings').append(li); });
    $('warnings').hidden = !messages.length;
  }
  function toast(message) { $('toast').textContent = t(message); $('toast').hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').hidden = true, 2700); }
  function updateHint() { $('pasteHint').classList.toggle('hidden', Boolean($('sourceInput').value)); }
  function wrap(latex) {
    const mode = $('outputMode').value;
    return mode === 'display' ? '\\[\n' + latex + '\n\\]' : mode === 'inline' ? '\\(' + latex + '\\)' : mode === 'dollars' ? '$$\n' + latex + '\n$$' : latex;
  }
  function unwrap(value) {
    value = value.trim();
    if ((value.startsWith('\\[') && value.endsWith('\\]')) || (value.startsWith('\\(') && value.endsWith('\\)')) || (value.startsWith('$$') && value.endsWith('$$'))) return value.slice(2, -2).trim();
    if (value.startsWith('$') && value.endsWith('$') && value.length > 1) return value.slice(1, -1);
    return value;
  }
  function renderPreview(latex) {
    $('preview').replaceChildren();
    if (!state.imageExporting) { state.lastImageExport = null; $('imageExportStatus').textContent = t('导出当前选中的公式 · 预览缩放不影响导出清晰度'); $('imageExportStatus').classList.remove('error'); }
    if (!latex) { const empty = document.createElement('span'); empty.className = 'empty'; empty.textContent = t('转换后，在这里核对公式'); $('preview').append(empty); updateImageButtons(); return; }
    try { $('preview').innerHTML = WordFormulaFonts.renderToString(latex, state.fontFamily, { output: 'htmlAndMathml', displayMode: true, throwOnError: true, trust: false, strict: 'ignore', maxExpand: 1000, maxSize: 20 }); }
    catch (error) { const warning = document.createElement('div'); warning.className = 'preview-error'; warning.textContent = t('暂时无法预览，请检查代码或在 LaTeX 编辑器中验证。\n{error}', { error: String(error.message).replace(/^KaTeX parse error: /, '').slice(0, 230) }); $('preview').append(warning); }
    updateImageButtons();
  }
  function updateImageButtons() {
    const disabled = state.busy || state.imageExporting || !state.styleValid || !$('preview').querySelector('.katex-html');
    $('exportPngButton').disabled = disabled; $('exportSvgButton').disabled = disabled;
    $('imageBackground').disabled = state.imageExporting; $('pngScale').disabled = state.imageExporting;
    ['formulaFontFamily', 'formulaFontSize', 'formulaColor', 'formulaColorPicker'].forEach((id) => { $(id).disabled = state.imageExporting; });
  }
  function applyFormulaStyle(normalize = false) {
    const fontSizePt = Number($('formulaFontSize').value);
    const sizeValid = $('formulaFontSize').value.trim() !== '' && Number.isFinite(fontSizePt) && fontSizePt >= 4 && fontSizePt <= 96;
    const hex = $('formulaColor').value.trim().replace(/^#/, '');
    const colorValid = /^(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(hex);
    state.styleValid = sizeValid && colorValid;
    $('formulaFontSize').setAttribute('aria-invalid', String(!sizeValid));
    $('formulaColor').setAttribute('aria-invalid', String(!colorValid));
    const errors = [];
    if (!sizeValid) errors.push(t('字号请输入 4–96 pt 之间的数字。'));
    if (!colorValid) errors.push(t('颜色请输入十六进制值，例如 #000000。'));
    $('formulaStyleError').textContent = errors.join(' ');
    $('formulaStyleError').hidden = !errors.length;
    if (state.styleValid) {
      state.fontSizePt = fontSizePt;
      state.formulaColor = '#' + (hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex).toLowerCase();
      $('preview').style.setProperty('--formula-font-size', (fontSizePt * 96 / 72) + 'px');
      $('preview').style.setProperty('--formula-color', state.formulaColor);
      $('formulaColorPicker').value = state.formulaColor;
      if (normalize) { $('formulaColor').value = state.formulaColor; $('formulaFontSize').value = String(fontSizePt); }
      if (!state.imageExporting) { state.lastImageExport = null; $('imageExportStatus').textContent = t('导出当前选中的公式 · 预览缩放不影响导出清晰度'); $('imageExportStatus').classList.remove('error'); }
    }
    updateImageButtons();
  }
  // Rebuild the menu when reopening a saved HTML, without retaining old choices.
  $('formulaFontFamily').replaceChildren(...WordFormulaFonts.options.map((font) => {
    const option = document.createElement('option');
    option.value = font.id; option.textContent = font.label;
    option.defaultSelected = font.id === 'default';
    return option;
  }));
  $('formulaFontFamily').value = state.fontFamily;
  $('formulaFontHint').textContent = WordFormulaFonts.get(state.fontFamily).hint;
  $('formulaFontFamily').addEventListener('change', () => {
    state.fontFamily = $('formulaFontFamily').value;
    $('formulaFontHint').textContent = WordFormulaFonts.get(state.fontFamily).hint;
    renderPreview(unwrap($('outputCode').value));
  });
  ['formulaFontSize', 'formulaColor'].forEach((id) => {
    $(id).addEventListener('input', () => applyFormulaStyle());
    $(id).addEventListener('change', () => applyFormulaStyle(true));
  });
  $('formulaColorPicker').addEventListener('input', () => { $('formulaColor').value = $('formulaColorPicker').value; applyFormulaStyle(); });
  $('formulaColorPicker').addEventListener('change', () => { $('formulaColor').value = $('formulaColorPicker').value; applyFormulaStyle(true); });
  applyFormulaStyle();
  function setPreviewScale(scale) {
    state.previewScale = Math.round(Math.max(0.5, Math.min(2, scale)) * 100) / 100;
    $('preview').style.setProperty('--preview-scale', state.previewScale);
    $('previewZoomReset').textContent = Math.round(state.previewScale * 100) + '%';
    $('previewZoomOut').disabled = state.previewScale <= 0.5;
    $('previewZoomIn').disabled = state.previewScale >= 2;
  }
  function fitPreview() {
    const equation = $('preview').querySelector('.katex-display');
    if (!equation) { toast('先输入一条公式，再调整预览宽度'); return; }
    const fit = () => {
      if (!equation.isConnected) return;
      const css = getComputedStyle($('preview'));
      const available = $('preview').clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight) - 4;
      const naturalWidth = equation.getBoundingClientRect().width / state.previewScale;
      if (naturalWidth > 0) setPreviewScale(Math.floor(available / naturalWidth * 100) / 100);
      $('preview').scrollLeft = 0;
    };
    if (document.fonts?.status === 'loading') document.fonts.ready.then(fit); else fit();
  }
  function expandPreview(expanded) {
    state.previewExpanded = expanded;
    $('previewCard').classList.toggle('is-expanded', expanded);
    document.body.classList.toggle('preview-expanded', expanded);
    $('previewExpand').textContent = expanded ? t('收起 ↙') : t('展开 ↗');
    $('previewExpand').setAttribute('aria-expanded', String(expanded));
    $('previewExpand').setAttribute('aria-label', expanded ? t('收起公式预览') : t('展开公式预览'));
    const main = document.querySelector('main');
    [...main.children].filter((element) => element !== $('previewCard')).forEach((element) => { element.inert = expanded; });
    document.querySelector('header').inert = expanded;
    document.querySelector('footer').inert = expanded;
    if (expanded) { $('previewCard').setAttribute('role', 'dialog'); $('previewCard').setAttribute('aria-modal', 'true'); }
    else { $('previewCard').removeAttribute('role'); $('previewCard').removeAttribute('aria-modal'); }
    $('previewExpand').focus({ preventScroll: true });
  }
  $('previewZoomOut').addEventListener('click', () => setPreviewScale(state.previewScale - 0.1));
  $('previewZoomIn').addEventListener('click', () => setPreviewScale(state.previewScale + 0.1));
  $('previewZoomReset').addEventListener('click', () => setPreviewScale(1));
  $('previewFit').addEventListener('click', fitPreview);
  $('previewExpand').addEventListener('click', () => expandPreview(!state.previewExpanded));
  document.addEventListener('keydown', (event) => {
    if (!state.previewExpanded) return;
    if (event.key === 'Escape') { event.preventDefault(); expandPreview(false); }
    if (event.key === 'Tab') {
      const focusable = [...$('previewCard').querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')];
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  function renderList() {
    $('equationList').hidden = state.equations.length <= 1;
    $('listTitle').textContent = t('共 {count} 条公式 · 点击切换', { count: state.equations.length });
    $('equationItems').replaceChildren();
    state.equations.forEach((equation, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'equation-chip';
      button.textContent = String(index + 1).padStart(2, '0') + '  ' + equation.latex.slice(0, 55);
      button.title = (equation.part ? equation.part + '\n' : '') + equation.latex;
      button.setAttribute('aria-pressed', String(state.index === index));
      button.addEventListener('click', () => { state.index = index; showEquation(); });
      $('equationItems').append(button);
    });
  }
  function showEquation() {
    const current = state.equations[state.index];
    $('outputCode').value = current ? wrap(current.latex) : '';
    $('characterCount').textContent = t('{count} 个字符', { count: $('outputCode').value.length });
    $('equationPosition').textContent = state.equations.length > 1 ? (state.index + 1) + ' / ' + state.equations.length : '';
    $('copyButton').disabled = !current || !current.latex.trim(); $('exportButton').disabled = !current || !current.latex.trim(); $('exportMdButton').disabled = !current || !current.latex.trim();
    $('formatBadge').textContent = current ? t(state.format) : t('等待输入'); $('formatBadge').classList.toggle('idle', !current);
    renderPreview(current?.latex || ''); renderList();
  }
  function invalidate() { state.equations = []; state.index = 0; showEquation(); warnings(); }
  function setResult(result, message) {
    state.equations = result.equations.filter((equation) => equation.latex.trim()); state.index = 0; state.format = result.format;
    if (!state.equations.length) throw new Error(t('没有找到可转换的公式。请粘贴完整公式，或导入含有原生公式的 .docx 文档。'));
    warnings(result.warnings); showEquation();
    status(message || (() => t('已转换 {count} 条公式 · {format}。请对照原文核对预览。', { count: state.equations.length, format: t(result.format) })), result.warnings?.length ? 'warning' : 'success');
  }
  function runConvert(extraWarnings = []) {
    if (state.busy) return;
    try {
      const source = state.source || $('sourceInput').value;
      if (source.length > 2000000) throw new Error(t('粘贴内容过大。请只复制需要的公式，或改用 .docx 导入。'));
      const chosen = $('inputMode').value;
      const result = WordLatex.convert(source, chosen === 'auto' ? state.kind : chosen);
      result.warnings = [...(result.warnings || []), ...extraWarnings]; setResult(result);
    } catch (error) { invalidate(); status(error.message || t('转换失败，请检查输入格式。'), 'error'); }
  }
  function acceptPaste({ html = '', plain = '', mathml = '', hasImage = false }) {
    if (state.busy) return;
    state.version++;
    const hasMath = /<(?:[\w.-]+:)?(?:math|oMath|oMathPara)\b/i.test(mathml || html);
    if (mathml) { state.source = mathml; state.kind = 'mathml'; }
    else if (hasMath) { state.source = html; state.kind = 'html'; }
    else if (plain.trim()) { state.source = plain; state.kind = 'auto'; }
    else if (html && !/<img\b/i.test(html) && !hasImage) {
      const template = document.createElement('template'); template.innerHTML = html;
      template.content.querySelectorAll('script,style,iframe,object,noscript').forEach((node) => node.remove());
      state.source = template.content.textContent || ''; state.kind = 'auto';
    } else {
      state.source = ''; state.kind = 'auto'; $('sourceInput').value = ''; updateHint();
      invalidate(); status(t('这次粘贴只有图片，浏览器没有收到公式结构。请用「导入 Word」读取 .docx，或在 Word 中切换为 LaTeX 线性格式后复制。'), 'warning');
      $('inputNote').textContent = t('图片无法直接转写。此工具不包含图片 OCR。'); return;
    }
    $('sourceInput').value = plain.trim() || state.source; $('inputMode').value = 'auto'; updateHint();
    $('inputNote').textContent = hasMath ? t('已读取剪贴板中的公式结构，可直接转换。') : t('已读取文本；转换后请核对上下标、分式和括号。');
    runConvert(!hasMath && (hasImage || /<img\b/i.test(html)) ? [t('剪贴板同时包含图片，目前只转换其文本；图片中的分式、上下标等结构可能已丢失。需要准确结构时请导入 .docx。')] : []);
  }
  $('sourceInput').addEventListener('paste', (event) => {
    const data = event.clipboardData; if (!data) return;
    event.preventDefault();
    acceptPaste({ plain: data.getData('text/plain'), html: data.getData('text/html'), mathml: data.getData('application/mathml+xml') || data.getData('text/mathml'), hasImage: [...data.items].some((item) => item.type.startsWith('image/')) });
  });
  $('sourceInput').addEventListener('input', () => {
    state.version++; state.source = ''; state.kind = 'auto'; invalidate(); updateHint();
    $('inputNote').textContent = t('支持粘贴 MathML、OMML 或 LaTeX；⌘ + Enter 立即转换。');
    status($('sourceInput').value.trim() ? t('输入已更新，点击「转换为 LaTeX」。') : t('支持 MathML、Word 原生公式与 LaTeX。文件只在本机处理。'));
  });
  $('sourceInput').addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); runConvert(); } });
  $('convertButton').addEventListener('click', () => runConvert());
  $('inputMode').addEventListener('change', () => { invalidate(); status(t('输入格式已更新，点击「转换为 LaTeX」。')); });
  $('clearButton').addEventListener('click', () => {
    state.version++; state.source = ''; state.kind = 'auto'; $('sourceInput').value = ''; $('inputMode').value = 'auto';
    invalidate(); updateHint(); $('inputNote').textContent = t('也可以拖入 .docx 文件，直接提取文档中的公式。'); status(t('已清空，可以粘贴下一条公式。')); $('sourceInput').focus();
  });
  document.querySelectorAll('[data-sample]').forEach((button) => button.addEventListener('click', () => {
    if (state.busy) return; state.version++; state.source = samples[button.dataset.sample]; state.kind = 'auto';
    $('sourceInput').value = state.source; $('inputMode').value = 'auto'; $('inputNote').textContent = t('示例公式 · 可以编辑代码，也可以粘贴你自己的公式。'); updateHint(); runConvert();
  }));
  $('outputMode').addEventListener('change', showEquation);
  $('outputCode').addEventListener('input', () => {
    const latex = unwrap($('outputCode').value);
    if (!state.equations.length && latex) { state.equations = [{ latex, source: 'manual' }]; state.index = 0; state.format = t('手动输入'); }
    else if (state.equations.length) state.equations[state.index].latex = latex;
    $('characterCount').textContent = t('{count} 个字符', { count: $('outputCode').value.length }); $('copyButton').disabled = !latex; $('exportButton').disabled = !latex; $('exportMdButton').disabled = !latex;
    $('formatBadge').textContent = t('已手动编辑'); $('formatBadge').classList.remove('idle'); renderPreview(latex); renderList();
  });
  async function copy(text) {
    try { if (!navigator.clipboard?.writeText) throw new Error('fallback'); await navigator.clipboard.writeText(text); toast('已复制 LaTeX 代码'); }
    catch {
      const area = document.createElement('textarea'); area.value = text; area.style.cssText = 'position:fixed;left:-10000px;top:0'; document.body.append(area); area.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch {} area.remove();
      if (ok) toast('已复制 LaTeX 代码');
      else { $('outputCode').focus(); $('outputCode').select(); status(t('浏览器未允许自动复制。已选中当前公式代码，请按 ⌘C；全部公式可用「导出 .tex」保存。'), 'warning'); }
    }
  }
  $('copyButton').addEventListener('click', () => copy($('outputCode').value));
  $('copyAllButton').addEventListener('click', () => copy(state.equations.map((equation) => wrap(equation.latex)).join('\n\n')));
  function download(blob, name) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
  $('exportButton').addEventListener('click', () => {
    const text = '% LaTeX equation snippets — generated locally\n% Recommended packages: amsmath, amssymb\n\n' + state.equations.filter((e) => e.latex.trim()).map((equation) => wrap(equation.latex)).join('\n\n') + '\n';
    download(new Blob([text], { type: 'text/plain;charset=utf-8' }), 'equations.tex'); toast('已导出全部公式');
  });
  $('exportMdButton').addEventListener('click', () => {
    const text = state.equations.filter((equation) => equation.latex.trim()).map((equation) => '$$\n' + equation.latex + '\n$$').join('\n\n') + '\n';
    download(new Blob([text], { type: 'text/markdown;charset=utf-8' }), 'equations.md');
    toast('已将全部公式导出为 Markdown（$$ 独立公式）');
  });
  async function exportEquationImage(format) {
    const latex = state.equations[state.index]?.latex.trim();
    if (!latex || state.busy || state.imageExporting || !state.styleValid || !$('preview').querySelector('.katex-html')) return;
    // Capture the selected expression and options before asynchronous rendering.
    const index = state.index + 1;
    const background = $('imageBackground').value;
    const pixelRatio = Number($('pngScale').value);
    const fontSizePt = state.fontSizePt;
    const color = state.formulaColor;
    const fontFamily = state.fontFamily;
    state.lastImageExport = null;
    state.imageExporting = true; updateImageButtons();
    $('imageExportStatus').textContent = t('正在本机生成 {format}…', { format: format.toUpperCase() });
    $('imageExportStatus').classList.remove('error');
    try {
      const result = await WordImageExport[format](latex, { background, pixelRatio, fontSizePt, color, fontFamily, padding: 16 });
      download(result.blob, 'equation-' + String(index).padStart(2, '0') + '.' + format);
      state.lastImageExport = { index, format, width: result.width, height: result.height, fontFamily, fontSizePt, color, background };
      showImageExportResult();
    } catch (error) {
      $('imageExportStatus').textContent = t(error.message) || t('图片生成失败，请检查公式后重试。');
      $('imageExportStatus').classList.add('error');
    } finally { state.imageExporting = false; updateImageButtons(); }
  }
  $('exportPngButton').addEventListener('click', () => exportEquationImage('png'));
  $('exportSvgButton').addEventListener('click', () => exportEquationImage('svg'));
  $('pasteButton').addEventListener('click', async () => {
    if (state.busy) return;
    try {
      if (!navigator.clipboard?.read) throw new Error('unavailable');
      const items = await navigator.clipboard.read(); const data = { html: '', plain: '', mathml: '', hasImage: false };
      for (const item of items) for (const type of item.types) {
        if (type.startsWith('image/')) data.hasImage = true;
        if (type === 'text/html') data.html += await (await item.getType(type)).text();
        if (type === 'text/plain') data.plain += await (await item.getType(type)).text();
        if (type === 'application/mathml+xml') data.mathml += await (await item.getType(type)).text();
      }
      acceptPaste(data);
    } catch { $('sourceInput').focus(); status(t('请在左侧输入框按 ⌘V 粘贴；当前浏览器未允许按钮读取剪贴板。'), 'warning'); }
  });
  function setBusy(busy) {
    state.busy = busy; $('convertButton').disabled = busy; $('importButton').disabled = busy; $('pasteButton').disabled = busy; $('sourceInput').disabled = busy; $('outputCode').disabled = busy;
    $('inputMode').disabled = busy; $('convertButton').textContent = busy ? t('正在读取文档…') : t('转换为 LaTeX →');
    updateImageButtons();
  }
  async function importFile(file) {
    if (!file || state.busy) return;
    if (!/\.docx$/i.test(file.name)) { status(t('请导入 .docx 文件。旧版 .doc、PDF 或图片请先在 Word 中另存为 .docx（图片本身不会自动变为公式）。'), 'warning'); return; }
    const version = ++state.version; invalidate(); setBusy(true); status(t('正在本机读取文档中的原生公式…'));
    try {
      const result = await WordDocx.extract(file); if (version !== state.version) return;
      const equations = []; const mathSources = []; const notices = [...result.warnings]; let legacy = false;
      for (const part of result.parts) {
        if (/<(?:\w+:)?(?:OLEObject|object)\b/i.test(part.xml)) legacy = true;
        const doc = new DOMParser().parseFromString(part.xml, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length) throw new Error(t('文档中的 {part} XML 无法解析。', { part: part.name }));
        const math = [...doc.getElementsByTagNameNS('*', 'oMath')]; if (!math.length) continue;
        mathSources.push(...math.map((node) => new XMLSerializer().serializeToString(node)));
        const converted = WordLatex.convert(part.xml, 'omml');
        equations.push(...converted.equations.map((equation) => ({ ...equation, part: part.name })));
        notices.push(...converted.warnings);
      }
      if (!equations.length) throw new Error(t('文档中没有找到 Word 原生公式。图片、扫描公式和旧版 Equation Editor / MathType 嵌入对象无法直接提取。'));
      if (legacy) notices.push(t('文档包含嵌入对象，可能有旧版 Equation Editor 或 MathType 公式未被提取。这里只列出 Word 原生公式。'));
      state.source = '<root>' + mathSources.join('') + '</root>'; state.kind = 'omml'; $('inputMode').value = 'auto'; state.importInfo = { file: file.name, count: equations.length }; state.importSummary = t('已导入：{file}\n\n提取到 {count} 条原生公式。\n在下方列表中选择公式，或重新粘贴以替换文档结果。', state.importInfo); $('sourceInput').value = state.importSummary;
      $('inputNote').textContent = t('仅本机读取 · 正文 → 脚注 → 尾注 → 页眉 → 页脚；含图片公式时请自行核对。'); updateHint();
      setResult({ equations, format: 'Word / DOCX', warnings: notices }, t('已从「{file}」提取 {count} 条原生公式。导出 .tex 可保存全部。', { file: file.name, count: equations.length }));
    } catch (error) { if (version === state.version) { invalidate(); status(error.message || t('无法读取该文档。请用 Word 另存为 .docx 后重试。'), 'error'); } }
    finally { setBusy(false); $('fileInput').value = ''; }
  }
  $('importButton').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', (event) => importFile(event.target.files[0]));
  ['dragenter', 'dragover'].forEach((type) => $('pasteZone').addEventListener(type, (event) => { event.preventDefault(); $('pasteZone').classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach((type) => $('pasteZone').addEventListener(type, (event) => { event.preventDefault(); $('pasteZone').classList.remove('dragging'); }));
  $('pasteZone').addEventListener('drop', (event) => { if (event.dataTransfer.files.length) importFile(event.dataTransfer.files[0]); else acceptPaste({ plain: event.dataTransfer.getData('text/plain'), html: event.dataTransfer.getData('text/html') }); });
  $('helpButton').addEventListener('click', () => { $('guide').open = true; $('guide').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  $('downloadApp').addEventListener('click', () => {
    const clone = document.documentElement.cloneNode(true);
    // Save a clean reusable tool, without the user's pasted content or converted document.
    clone.querySelectorAll('textarea').forEach((area) => { area.textContent = ''; area.value = ''; });
    clone.querySelector('#preview').innerHTML = '<span class="empty"></span>'; clone.querySelector('#preview .empty').textContent = t('转换后，在这里核对公式');
    clone.querySelector('#preview').style.setProperty('--preview-scale', 1);
    clone.querySelector('#preview').style.setProperty('--formula-font-size', '16px');
    clone.querySelector('#preview').style.setProperty('--formula-color', '#000000');
    clone.querySelector('#formulaFontFamily').value = 'default';
    clone.querySelector('#formulaFontFamily').disabled = false;
    clone.querySelector('#formulaFontHint').textContent = WordFormulaFonts.get('default').hint;
    Object.entries({ formulaFontSize: '12', formulaColor: '#000000', formulaColorPicker: '#000000' }).forEach(([id, value]) => {
      const input = clone.querySelector('#' + id); input.value = value; input.setAttribute('value', value); input.disabled = false; input.removeAttribute('aria-invalid');
    });
    clone.querySelector('#formulaStyleError').textContent = ''; clone.querySelector('#formulaStyleError').hidden = true;
    clone.querySelector('#previewZoomReset').textContent = '100%';
    clone.querySelector('#previewZoomIn').disabled = false; clone.querySelector('#previewZoomOut').disabled = false;
    clone.querySelector('#previewCard').classList.remove('is-expanded'); clone.querySelector('body').classList.remove('preview-expanded');
    clone.querySelector('#previewCard').removeAttribute('role'); clone.querySelector('#previewCard').removeAttribute('aria-modal');
    clone.querySelector('#previewExpand').textContent = t('展开 ↗'); clone.querySelector('#previewExpand').setAttribute('aria-expanded', 'false');
    clone.querySelector('#previewExpand').setAttribute('aria-label', t('展开公式预览'));
    clone.querySelectorAll('[inert]').forEach((element) => element.removeAttribute('inert'));
    clone.querySelector('#equationItems').replaceChildren(); clone.querySelector('#equationList').hidden = true;
    clone.querySelector('#warnings').replaceChildren(); clone.querySelector('#warnings').hidden = true;
    clone.querySelector('#pasteHint').classList.remove('hidden'); clone.querySelector('#toast').hidden = true; clone.querySelector('#toast').textContent = '';
    clone.querySelector('#status').textContent = t('支持 MathML、Word 原生公式与 LaTeX。文件只在本机处理。'); clone.querySelector('#status').className = 'status';
    clone.querySelector('#inputNote').textContent = t('也可以拖入 .docx 文件，直接提取文档中的公式。');
    clone.querySelector('#formatBadge').textContent = t('等待输入'); clone.querySelector('#formatBadge').className = 'format-pill idle';
    clone.querySelector('#characterCount').textContent = t('{count} 个字符', { count: 0 }); clone.querySelector('#equationPosition').textContent = '';
    clone.querySelector('#listTitle').textContent = t('文档中的公式');
    clone.querySelector('#copyButton').disabled = true; clone.querySelector('#exportButton').disabled = true; clone.querySelector('#exportMdButton').disabled = true;
    clone.querySelector('#exportPngButton').disabled = true; clone.querySelector('#exportSvgButton').disabled = true;
    clone.querySelector('#imageBackground').disabled = false; clone.querySelector('#pngScale').disabled = false;
    clone.querySelector('#imageExportStatus').textContent = t('导出当前选中的公式 · 预览缩放不影响导出清晰度');
    clone.querySelector('#imageExportStatus').classList.remove('error');
    ['convertButton', 'importButton', 'pasteButton', 'sourceInput', 'outputCode', 'inputMode'].forEach((id) => { clone.querySelector('#' + id).disabled = false; });
    clone.querySelector('#convertButton').textContent = t('转换为 LaTeX →');
    clone.querySelectorAll('select option').forEach((option) => option.removeAttribute('selected'));
    clone.querySelector('#formulaFontFamily option[value="default"]').setAttribute('selected', '');
    clone.querySelector('#pngScale option[value="3"]').setAttribute('selected', '');
    clone.querySelector('#languageSelect option[value="' + WordI18n.language + '"]').setAttribute('selected', '');
    WordI18n.refresh(clone);
    download(new Blob(['<!doctype html>\n' + clone.outerHTML], { type: 'text/html;charset=utf-8' }), 'Word公式转LaTeX.html'); toast('已保存独立 HTML，可离线使用');
  });

  function showImageExportResult() {
    const item = state.lastImageExport;
    if (!item) return;
    const details = [item.format.toUpperCase(), item.format === 'png' ? item.width + ' × ' + item.height + ' px' : t('矢量图'), WordFormulaFonts.get(item.fontFamily).label, item.fontSizePt + ' pt', item.color, t(item.background === 'transparent' ? t('透明背景') : t('白色背景'))].join(' · ');
    $('imageExportStatus').textContent = t('已导出公式 {index} · {details}', { index: item.index, details });
  }
  function refreshLanguage() {
    // All these nodes contain app-generated messages, never editable equation text.
    ['status', 'inputNote', 'formatBadge', 'listTitle', 'imageExportStatus', 'toast', 'formulaStyleError', 'convertButton'].forEach((id) => {
      const element = $(id); element.textContent = t(element.textContent);
    });
    $('warnings').querySelectorAll('li').forEach((element) => { element.textContent = t(element.textContent); });
    $('preview').querySelectorAll('.empty,.preview-error').forEach((element) => { element.textContent = t(element.textContent); });
    [...$('formulaFontFamily').options].forEach((option) => { option.textContent = WordFormulaFonts.get(option.value).label; });
    $('formulaFontHint').textContent = WordFormulaFonts.get(state.fontFamily).hint;
    $('characterCount').textContent = t('{count} 个字符', { count: $('outputCode').value.length });
    $('previewExpand').textContent = t(state.previewExpanded ? t('收起 ↙') : t('展开 ↗'));
    $('previewExpand').setAttribute('aria-label', t(state.previewExpanded ? t('收起公式预览') : t('展开公式预览')));
    if (state.importInfo && $('sourceInput').value === state.importSummary) {
      state.importSummary = t('已导入：{file}\n\n提取到 {count} 条原生公式。\n在下方列表中选择公式，或重新粘贴以替换文档结果。', state.importInfo);
      $('sourceInput').value = state.importSummary;
    }
    if (state.statusRenderer) $('status').textContent = state.statusRenderer();
    showImageExportResult();
  }
  window.addEventListener('word-language-change', refreshLanguage);
  $('languageSelect').addEventListener('change', () => WordI18n.setLanguage($('languageSelect').value));
  WordI18n.setLanguage(WordI18n.language);
})();
