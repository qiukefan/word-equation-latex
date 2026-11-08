/* Local UI translations only. User equations and documents are never translated. */
(function (root) {
  'use strict';
  const exact = new Map();
  const templates = [];
  const requestedLanguage = new URLSearchParams(root.location.search).get('lang');
  let language = requestedLanguage === 'en' || (!requestedLanguage && document.documentElement.lang === 'en') ? 'en' : 'zh';
  function pattern(value) {
    const names = [];
    let source = '', offset = 0;
    for (const match of value.matchAll(/\{([a-zA-Z][\w]*)\}/g)) {
      source += value.slice(offset, match.index).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([\\s\\S]*?)';
      names.push(match[1]); offset = match.index + match[0].length;
    }
    source += value.slice(offset).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return names.length ? { expression: new RegExp('^' + source + '$'), names } : null;
  }
  function register(messages) {
    Object.entries(messages).forEach(([zh, en]) => {
      const pair = { zh, en };
      exact.set(zh, pair); exact.set(en, pair);
      const chinese = pattern(zh), english = pattern(en);
      if (chinese || english) templates.push({ pair, patterns: [chinese, english].filter(Boolean) });
    });
  }
  function substitute(template, values) {
    return template.replace(/\{([a-zA-Z][\w]*)\}/g, (match, name) => Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match);
  }
  function t(message, values) {
    const source = String(message == null ? '' : message);
    const found = exact.get(source);
    if (found) return substitute(found[language], values || {});
    for (const entry of templates) for (const candidate of entry.patterns) {
      const match = source.match(candidate.expression);
      if (match) {
        const captured = {};
        candidate.names.forEach((name, index) => { captured[name] = match[index + 1]; });
        return substitute(entry.pair[language], values || captured);
      }
    }
    return values ? substitute(source, values) : source;
  }
  function refresh(scope = document) {
    const attributes = ['placeholder', 'title', 'aria-label', 'content'];
    const selectors = ['[data-i18n]', ...attributes.map((name) => '[data-i18n-' + name + ']')].join(',');
    const elements = [...scope.querySelectorAll(selectors)];
    if (scope.matches && scope.matches(selectors)) elements.unshift(scope);
    elements.forEach((element) => {
      if (element.hasAttribute('data-i18n')) element.textContent = t(element.getAttribute('data-i18n'));
      attributes.forEach((name) => {
        if (element.hasAttribute('data-i18n-' + name)) element.setAttribute(name, t(element.getAttribute('data-i18n-' + name)));
      });
    });
  }
  function setLanguage(value) {
    language = value === 'en' ? 'en' : 'zh';
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    const control = document.getElementById('languageSelect');
    if (control) control.value = language;
    refresh();
    root.dispatchEvent(new CustomEvent('word-language-change', { detail: { language } }));
  }
  root.WordI18n = Object.freeze({ register, t, refresh, setLanguage, get language() { return language; } });
  register({
  "公式转写": "Word to LaTeX",
  "公式转写 · Word to LaTeX": "Word to LaTeX · Equation Converter",
  "在你的浏览器中处理": "Processed in your browser",
  "使用帮助 ↗": "Help ↗",
  "从 Word，到": "From Word to",
  "让公式回到代码。粘贴、转换，然后继续你的写作。": "Turn equations into code. Paste, convert, and keep writing.",
  "为 macOS 工作流设计": "Designed for macOS",
  "在线版仅加载网页；Word 文档与公式只在浏览器本地处理，不上传。保存 HTML 后可离线使用。": "The online version loads only the app. Your Word documents and equations stay in your browser and are never uploaded. Save the HTML to use it offline.",
  "粘贴公式": "Paste an equation",
  "清空": "Clear",
  "从 Word 复制，或输入公式代码": "Copy from Word or enter equation code",
  "输入格式": "Input format",
  "自动识别": "Auto-detect",
  "Unicode / 文本": "Unicode / Text",
  "粘贴 Word 公式或输入 MathML、OMML、LaTeX": "Paste a Word equation or enter MathML, OMML, or LaTeX",
  "在这里粘贴公式": "Paste an equation here",
  "在这里粘贴你的公式": "Paste your equation here",
  "在 Word 中选中公式并复制": "Select and copy an equation in Word",
  "回到这里，按": "Return here and press",
  "也可以拖入 .docx 文件，直接提取文档中的公式。": "You can also drop a .docx file here to extract its equations.",
  "转换为 LaTeX": "Convert to LaTeX",
  "转换为 LaTeX →": "Convert to LaTeX →",
  "导入 Word": "Import Word",
  "试一试": "Try an example",
  "分式": "Fraction",
  "积分": "Integral",
  "矩阵": "Matrix",
  "读取剪贴板": "Read clipboard",
  "LaTeX 代码": "LaTeX code",
  "等待输入": "Waiting for input",
  "OUTPUT / 可编辑": "OUTPUT / EDITABLE",
  "LaTeX 输出代码，可手动修改": "LaTeX output code, editable",
  "LaTeX 代码将显示在这里…": "Your LaTeX code will appear here…",
  "{count} 个字符": "{count} characters",
  "输出格式": "Output format",
  "LaTeX 输出包裹格式": "LaTeX output delimiters",
  "纯 LaTeX": "Plain LaTeX",
  "\\[ 独立公式 \\]": "\\[ Display \\]",
  "\\( 行内公式 \\)": "\\( Inline \\)",
  "$$ 公式 $$": "$$ Display $$",
  "复制代码": "Copy code",
  "按所选输出格式导出全部公式": "Export all equations using the selected output format",
  "将全部公式导出为 Markdown，使用 $$ 独立公式格式": "Export all equations as Markdown with $$ display math",
  "导出 .tex ↗": "Export .tex ↗",
  "导出 .md ↗": "Export .md ↗",
  "公式预览": "Equation preview",
  "实时排版 · 本地渲染": "Live preview · Local rendering",
  "预览缩放": "Preview zoom",
  "缩小公式": "Zoom out",
  "缩小": "Zoom out",
  "重置缩放为 100%": "Reset zoom to 100%",
  "点击恢复 100%": "Reset to 100%",
  "放大公式": "Zoom in",
  "放大": "Zoom in",
  "缩放公式以适应画布宽度": "Fit the equation to the canvas width",
  "适应宽度": "Fit width",
  "展开公式预览": "Expand equation preview",
  "展开 ↗": "Expand ↗",
  "收起 ↙": "Collapse ↙",
  "收起公式预览": "Collapse equation preview",
  "字体": "Font",
  "公式字体": "Equation font",
  "默认数学字体": "Default math font",
  "字号": "Size",
  "公式字号（pt）": "Equation font size (pt)",
  "颜色": "Color",
  "选择公式颜色": "Choose equation color",
  "公式颜色（十六进制）": "Equation color (hex)",
  "仅应用于预览与图片 · 缩放仅用于查看": "Applies to preview and images · Zoom is for viewing only",
  "保留公式原有字体；积分、括号等数学符号自动匹配。": "Preserves equation fonts; mathematical symbols are matched automatically.",
  "公式预览画布，可横向滚动": "Equation preview canvas, horizontally scrollable",
  "转换后，在这里核对公式": "Check your equation here after converting",
  "字体已内置，断网也能完整显示": "Fonts are built in and work offline",
  "长公式可横向滚动 · 展开后按 Esc 收起": "Scroll wide equations horizontally · Press Esc to exit expanded view",
  "导出公式图片": "Export equation image",
  "背景": "Background",
  "图片背景": "Image background",
  "透明": "Transparent",
  "白色": "White",
  "PNG 清晰度": "PNG resolution",
  "PNG 导出清晰度": "PNG export resolution",
  "2 倍": "2×",
  "3 倍": "3×",
  "4 倍": "4×",
  "导出 PNG ↓": "Export PNG ↓",
  "导出 SVG ↓": "Export SVG ↓",
  "导出当前选中的公式 · 预览缩放不影响导出清晰度": "Exports the selected equation · Preview zoom does not affect export resolution",
  "支持 MathML、Word 原生公式与 LaTeX。文件只在本机处理。": "Supports MathML, native Word equations, and LaTeX. Files are processed locally.",
  "文档公式列表": "Document equation list",
  "文档中的公式": "Equations in this document",
  "复制全部": "Copy all",
  "第一次使用？关于 Mac 上的 Word 公式粘贴": "First time here? Pasting Word equations on Mac",
  "先试试直接粘贴": "Try pasting first",
  "选中 Word 里的完整公式，按 ⌘C，再到左侧按 ⌘V。工具会读取浏览器能提供的公式结构；不同 Word 版本和浏览器的粘贴结果可能不同。": "Select the complete equation in Word, press ⌘C, then press ⌘V in the input box. The app reads the equation structure available to your browser. Results may vary between Word versions and browsers.",
  "只有图片？导入 Word": "Only an image? Import Word",
  "将文档保存为 .docx，再点「导入 Word」。这会提取文档中的原生公式，并可逐条复制。图片公式、扫描内容及旧版 Equation Editor / MathType 对象不支持识别。": "Save your document as .docx, then choose Import Word to extract its native equations and copy them individually. Images, scans, and legacy Equation Editor / MathType objects are not supported.",
  "也可在 Word 中转为线性格式": "Use Word’s linear format",
  "如果你的 Word 提供 LaTeX 格式，在公式选项中选择 LaTeX，再转为「线性」。Mac 快捷键为 ⌘⇧=。普通文字粘贴可能丢失结构，请对照原公式核对。": "If your Word version supports LaTeX, choose LaTeX in the equation options, then convert to Linear format (⌘⇧= on Mac). Plain-text pasting can lose structure, so check the result against the original equation.",
  "微软操作说明 ↗": "Microsoft instructions ↗",
  "离线可用 · 无需账户 · 不上传文档": "Works offline · No account · No document uploads",
  "保存离线 HTML ↗": "Save offline HTML ↗",
  "语言": "Language",
  "在 Mac 上把 Word 公式转成 LaTeX。支持粘贴与 DOCX 导入，全部在本机浏览器处理。": "Convert Word equations to LaTeX on Mac. Paste or import DOCX files, processed entirely in your local browser.",
  "离线模式不加载外部组件": "External components are disabled in offline mode",
  "字号请输入 4–96 pt 之间的数字。": "Enter a font size between 4 and 96 pt.",
  "颜色请输入十六进制值，例如 #000000。": "Enter a hex color, for example #000000.",
  "先输入一条公式，再调整预览宽度": "Enter an equation before fitting the preview width",
  "共 {count} 条公式 · 点击切换": "{count} equations · Click to select",
  "没有找到可转换的公式。请粘贴完整公式，或导入含有原生公式的 .docx 文档。": "No convertible equations found. Paste a complete equation or import a .docx document with native equations.",
  "已转换 {count} 条公式 · {format}。请对照原文核对预览。": "Converted {count} equations · {format}. Check the preview against the original.",
  "粘贴内容过大。请只复制需要的公式，或改用 .docx 导入。": "The pasted content is too large. Copy only the equations you need, or import a .docx file.",
  "转换失败，请检查输入格式。": "Conversion failed. Check the input format.",
  "这次粘贴只有图片，浏览器没有收到公式结构。请用「导入 Word」读取 .docx，或在 Word 中切换为 LaTeX 线性格式后复制。": "The clipboard contains only an image; no equation structure was received. Use Import Word to read the .docx file, or switch to LaTeX linear format in Word and copy again.",
  "图片无法直接转写。此工具不包含图片 OCR。": "Images cannot be converted directly. This tool does not include image OCR.",
  "已读取剪贴板中的公式结构，可直接转换。": "Equation structure read from the clipboard and ready to convert.",
  "已读取文本；转换后请核对上下标、分式和括号。": "Text read. Check subscripts, superscripts, fractions, and brackets after converting.",
  "剪贴板同时包含图片，目前只转换其文本；图片中的分式、上下标等结构可能已丢失。需要准确结构时请导入 .docx。": "The clipboard also contains an image. Only its text is converted, so fractions, subscripts, or superscripts may lose structure. Import the .docx file for accurate structure.",
  "支持粘贴 MathML、OMML 或 LaTeX；⌘ + Enter 立即转换。": "Paste MathML, OMML, or LaTeX; press ⌘ + Enter to convert.",
  "输入已更新，点击「转换为 LaTeX」。": "Input updated. Click Convert to LaTeX.",
  "输入格式已更新，点击「转换为 LaTeX」。": "Input format updated. Click Convert to LaTeX.",
  "已清空，可以粘贴下一条公式。": "Cleared. You can paste another equation.",
  "示例公式 · 可以编辑代码，也可以粘贴你自己的公式。": "Example equation · Edit the code or paste your own equation.",
  "手动输入": "Manual input",
  "已手动编辑": "Manually edited",
  "已复制 LaTeX 代码": "LaTeX code copied",
  "浏览器未允许自动复制。已选中当前公式代码，请按 ⌘C；全部公式可用「导出 .tex」保存。": "Automatic copying is unavailable. The current code is selected; press ⌘C to copy it. Use Export .tex to save all equations.",
  "已导出全部公式": "All equations exported",
  "已将全部公式导出为 Markdown（$$ 独立公式）": "All equations exported as Markdown ($$ display math)",
  "正在本机生成 {format}…": "Generating {format} locally…",
  "已导出公式 {index} · {details}": "Exported equation {index} · {details}",
  "矢量图": "Vector image",
  "透明背景": "Transparent background",
  "白色背景": "White background",
  "图片生成失败，请检查公式后重试。": "Image generation failed. Check the equation and try again.",
  "请在左侧输入框按 ⌘V 粘贴；当前浏览器未允许按钮读取剪贴板。": "Press ⌘V in the input box to paste. This browser did not allow the button to read the clipboard.",
  "正在读取文档…": "Reading document…",
  "请导入 .docx 文件。旧版 .doc、PDF 或图片请先在 Word 中另存为 .docx（图片本身不会自动变为公式）。": "Import a .docx file. Save older .doc files, PDFs, or images as .docx in Word first (images are not automatically converted into equations).",
  "正在本机读取文档中的原生公式…": "Reading native equations locally…",
  "文档中的 {part} XML 无法解析。": "Cannot parse the XML in {part}.",
  "文档中没有找到 Word 原生公式。图片、扫描公式和旧版 Equation Editor / MathType 嵌入对象无法直接提取。": "No native Word equations found. Images, scanned equations, and legacy Equation Editor / MathType embedded objects cannot be extracted directly.",
  "文档包含嵌入对象，可能有旧版 Equation Editor 或 MathType 公式未被提取。这里只列出 Word 原生公式。": "The document contains embedded objects. Some legacy Equation Editor or MathType equations may not have been extracted. Only native Word equations are listed.",
  "仅本机读取 · 正文 → 脚注 → 尾注 → 页眉 → 页脚；含图片公式时请自行核对。": "Read locally · Body → footnotes → endnotes → headers → footers. Check any image equations manually.",
  "已从「{file}」提取 {count} 条原生公式。导出 .tex 可保存全部。": "Extracted {count} native equations from “{file}”. Use Export .tex to save them all.",
  "无法读取该文档。请用 Word 另存为 .docx 后重试。": "Cannot read this document. Save it as .docx in Word and try again.",
  "已保存独立 HTML，可离线使用": "Standalone HTML saved for offline use",
  "未知的公式字体，请从字体下拉框中重新选择。": "Unknown equation font. Select a font from the menu again.",
  "公式代码必须是文本。": "Equation code must be text.",
  "离线公式字体组件未加载，请重新打开 HTML 文件。": "The offline equation font component did not load. Reopen the HTML file.",
  "公式包含工具保留的字体标记名称，请修改该名称后重试。": "The equation contains a reserved font marker name. Rename it and try again.",
  "保留公式原有字体与数学排版。": "Preserves the equation’s original fonts and mathematical layout.",
  "正体 · Roman": "Roman",
  "字母使用正体；保留公式中单独指定的字体。": "Uses upright letters while preserving explicitly specified fonts.",
  "粗体 · Bold": "Bold",
  "支持的字母与数字使用粗体；其他数学符号保留适合的字形。": "Uses bold letters and digits where supported; other symbols keep suitable math glyphs.",
  "斜体 · Italic": "Italic",
  "字母与数字使用斜体；保留公式中单独指定的字体。": "Uses italic letters and digits while preserving explicitly specified fonts.",
  "粗斜体 · Bold italic": "Bold italic",
  "数学变量使用粗斜体，数字及适用符号使用粗体。": "Uses bold italic math variables, with bold digits and supported symbols.",
  "花体 · Calligraphic": "Calligraphic",
  "花体适用于大写拉丁字母；其他字符保留数学字形。": "Calligraphic applies to uppercase Latin letters; other characters keep math glyphs.",
  "手写体 · Script": "Script",
  "手写体适用于大写拉丁字母；其他字符保留数学字形。": "Script applies to uppercase Latin letters; other characters keep math glyphs.",
  "哥特体 · Fraktur": "Fraktur",
  "哥特体适用于拉丁字母和数字；其他字符保留数学字形。": "Fraktur applies to Latin letters and digits; other characters keep math glyphs.",
  "黑板粗体 · Blackboard": "Blackboard bold",
  "黑板粗体适用于大写拉丁字母和小写 k；其他字符保留数学字形。": "Blackboard bold applies to uppercase Latin letters and lowercase k; other characters keep math glyphs.",
  "无衬线 · Sans serif": "Sans serif",
  "字母与数字使用无衬线字体；不支持的字符保留数学字形。": "Uses sans serif letters and digits; unsupported characters keep math glyphs.",
  "等宽 · Typewriter": "Typewriter",
  "字母与数字使用等宽字体；不支持的字符保留数学字形。": "Uses monospaced letters and digits; unsupported characters keep math glyphs.",
  "暂时无法预览，请检查代码或在 LaTeX 编辑器中验证。\n{error}": "Preview unavailable. Check the code or verify it in a LaTeX editor.\n{error}",
  "字号请输入 4–96 pt 之间的数字。 颜色请输入十六进制值，例如 #000000。": "Enter a font size between 4 and 96 pt. Enter a hex color, for example #000000.",
  "已导入：{file}\n\n提取到 {count} 条原生公式。\n在下方列表中选择公式，或重新粘贴以替换文档结果。": "Imported: {file}\n\nExtracted {count} native equations.\nSelect an equation below, or paste again to replace the document results."
});
})(window);
