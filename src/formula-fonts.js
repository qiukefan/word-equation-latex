/* Shared, entirely local font styles for KaTeX preview and MathJax image export.
 * Styling applies to a rendering copy, never to the editable LaTeX source.
 * MathML needs a little extra font information: its standard "script" variant
 * cannot distinguish TeX calligraphic letters from the separate script font.
 */
(function (root) {
  'use strict';
  const t = (message) => root.WordI18n ? root.WordI18n.t(message) : message;
  const definitions = [
    ['default', '默认数学字体', '', '保留公式原有字体与数学排版。'],
    ['roman', '正体 · Roman', 'mathrm', '字母使用正体；保留公式中单独指定的字体。'],
    ['bold', '粗体 · Bold', 'mathbf', '支持的字母与数字使用粗体；其他数学符号保留适合的字形。'],
    ['italic', '斜体 · Italic', 'mathit', '字母与数字使用斜体；保留公式中单独指定的字体。'],
    ['bolditalic', '粗斜体 · Bold italic', 'boldsymbol', '数学变量使用粗斜体，数字及适用符号使用粗体。'],
    ['caligraphic', '花体 · Calligraphic', 'mathcal', '花体适用于大写拉丁字母；其他字符保留数学字形。'],
    ['script', '手写体 · Script', 'mathscr', '手写体适用于大写拉丁字母；其他字符保留数学字形。'],
    ['fraktur', '哥特体 · Fraktur', 'mathfrak', '哥特体适用于拉丁字母和数字；其他字符保留数学字形。'],
    ['double-struck', '黑板粗体 · Blackboard', 'mathbb', '黑板粗体适用于大写拉丁字母和小写 k；其他字符保留数学字形。'],
    ['sans', '无衬线 · Sans serif', 'mathsf', '字母与数字使用无衬线字体；不支持的字符保留数学字形。'],
    ['typewriter', '等宽 · Typewriter', 'mathtt', '字母与数字使用等宽字体；不支持的字符保留数学字形。']
  ];
  const options = Object.freeze(definitions.map(([id, label, command, hint]) => Object.freeze({id, get label() { return t(label); }, command, get hint() { return t(hint); }})));
  const byId = new Map(options.map((option) => [option.id, option]));
  const commands = [...new Set(options.map((option) => option.command).filter(Boolean)), 'mathnormal'];
  const markerPrefix = 'wordFormulaFontMarker';
  const macroPrefix = 'WordFormulaFontOriginal';
  const markerFonts = new Map(commands.map((command) => [markerPrefix + command, command]));
  const markerColor = '\\WordFormulaFontMarkColor';
  const declarationColor = '\\WordFormulaFontDeclareColor';
  const aliases = {Bbb: 'mathbb', bold: 'mathbf', frak: 'mathfrak', bm: 'boldsymbol'};
  const declarations = {rm: 'mathrm', sf: 'mathsf', tt: 'mathtt', bf: 'mathbf', it: 'mathit', cal: 'mathcal'};
  // These aliases preserve the original functions, including nested user font
  // commands, without enabling KaTeX's HTML trust option or external resources.
  const prelude = '\\let' + markerColor + '\\textcolor\n\\let' + declarationColor + '\\color\n' + [...commands.map((command) => [command, command]), ...Object.entries(aliases)].map(([command, font]) => {
    const original = '\\' + macroPrefix + command;
    return '\\let' + original + '\\' + command + '\\def\\' + command + '#1{' + markerColor + '{' + markerPrefix + font + '}{' + original + '{#1}}}';
  }).join('\n') + '\n' + Object.entries(declarations).map(([command, font]) => {
    const original = '\\' + macroPrefix + command;
    return '\\let' + original + '\\' + command + '\\def\\' + command + '{' + declarationColor + '{' + markerPrefix + font + '}' + original + '}';
  }).join('\n') + '\n';
  const fontClasses = new Map([
    ['mathcal', ['script', '-tex-calligraphic']],
    ['mathscr', ['script']], ['mathbb', ['double-struck']],
    ['mathfrak', ['fraktur']], ['mathsf', ['sans-serif']],
    ['mathtt', ['monospace']], ['mathit', ['italic', '-tex-mathit']],
    ['mathbf', ['bold']], ['boldsymbol', ['bold-italic']],
    ['mathrm', ['normal']], ['mathnormal', ['italic']]
  ]);
  const expectedVariants = {
    mathcal: ['script'], mathscr: ['script'], mathbb: ['double-struck'],
    mathfrak: ['fraktur'], mathsf: ['sans-serif'], mathtt: ['monospace'],
    mathbf: ['bold'], boldsymbol: ['bold', 'bold-italic'], mathrm: ['normal'],
    mathit: ['italic'], mathnormal: []
  };
  const glyphCache = new Map();

  function get(id = 'default') {
    const option = byId.get(id);
    if (!option) throw new Error(t('未知的公式字体，请从字体下拉框中重新选择。'));
    return option;
  }

  function sourceWithFont(latex, option) {
    // The newlines keep a trailing TeX comment from swallowing the closing brace.
    return option.command ? '\\' + option.command + '{\n' + latex + '\n}' : latex;
  }

  function probeGlyph(command, character) {
    const key = command + ':' + character;
    if (glyphCache.has(key)) return glyphCache.get(key);
    const escaped = /[#$%&_{}]/.test(character) ? '\\' + character : character === '\\' ? '\\backslash' : character;
    let variant = null;
    try {
      const tree = root.katex.__renderToHTMLTree('\\' + command + '{' + escaped + '}', {
        output: 'html', strict: 'ignore', trust: false, throwOnError: true,
        maxExpand: 1000, maxSize: 20
      });
      const leaves = [];
      function inspect(node) {
        if (typeof node.text === 'string' && node.text) leaves.push(node);
        for (const child of node.children || []) inspect(child);
      }
      inspect(tree);
      if (leaves.length === 1 && leaves[0].text === character) {
        const name = (leaves[0].classes || []).find((value) => fontClasses.has(value));
        variant = name ? fontClasses.get(name) : ['normal'];
      }
    } catch { /* Keep the existing MathML variant for an unfamiliar symbol. */ }
    // Bound the cache even for very large pasted expressions with varied Unicode.
    if (glyphCache.size >= 4096) glyphCache.clear();
    glyphCache.set(key, variant);
    return variant;
  }

  function repairToken(node, command) {
    if (!command || !['mi', 'mn', 'mo'].includes(node.type)) return;
    if (!(node.children || []).every((child) => typeof child.text === 'string')) return;
    const text = node.children.map((child) => child.text).join('');
    const characters = [...text];
    if (!characters.length) return;
    const variant = node.attributes?.mathvariant;
    const targeted = expectedVariants[command]?.includes(variant) ||
      (command === 'mathit' && node.type === 'mi' && characters.length === 1 && !variant);
    if (!targeted) return;
    const variants = characters.map((character) => probeGlyph(command, character));
    if (variants.some((value) => !value)) return;
    // KaTeX normally coalesces only consecutive digits here. Avoid changing a
    // mixed token's semantics if a future library starts grouping other text.
    const first = variants[0];
    if (!variants.every((value) => value[0] === first[0] && value[1] === first[1])) return;
    node.attributes.mathvariant = first[0];
    if (first[1]) node.attributes['data-mjx-variant'] = first[1];
    else delete node.attributes['data-mjx-variant'];
  }

  function renderToString(latex, fontFamily = 'default', settings = {}) {
    const option = get(fontFamily);
    if (typeof latex !== 'string') throw new Error(t('公式代码必须是文本。'));
    if (!root.katex) throw new Error(t('离线公式字体组件未加载，请重新打开 HTML 文件。'));
    const source = sourceWithFont(latex, option);
    const renderSettings = {...settings, trust: false};
    if (renderSettings.output !== 'mathml') return root.katex.renderToString(source, renderSettings);
    if (source.includes(markerPrefix) || source.includes(macroPrefix) || source.includes(markerColor) || source.includes(declarationColor)) {
      throw new Error(t('公式包含工具保留的字体标记名称，请修改该名称后重试。'));
    }
    // A group keeps helper definitions local even when globalGroup is requested.
    const tree = root.katex.__renderToDomTree('{\n' + prelude + source + '\n}', renderSettings);
    function repair(node, inheritedFont) {
      let font = inheritedFont;
      const marker = node.type === 'mstyle' && node.attributes?.mathcolor;
      if (markerFonts.has(marker)) {
        font = markerFonts.get(marker);
        delete node.attributes.mathcolor;
      }
      if (node.type === 'annotation' && node.attributes?.encoding === 'application/x-tex') {
        if (node.children?.length === 1) node.children[0].text = source;
        return;
      }
      repairToken(node, font);
      for (const child of node.children || []) repair(child, font);
    }
    repair(tree, '');
    return tree.toMarkup();
  }

  root.WordFormulaFonts = Object.freeze({options, get, renderToString});
})(window);
