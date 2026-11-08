/* WordLatex: browser-only, no network and no DOM insertion of pasted content.
 * convert(input, kind = 'auto') -> { equations: [{ latex, source }], format, warnings }
 * kind: auto | html | mathml | omml | latex | text. Throws Error for empty input,
 * invalid formula XML, or clipboard HTML without an equation/text representation.
 * XML conversion is structural. Plain text is deliberately conservative and
 * reports its limitations; it is not a complete UnicodeMath grammar or OCR.
 */
(function (global) {
  'use strict';
  const OMML = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
  const MATHML = 'http://www.w3.org/1998/Math/MathML';
  const WORD = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const symbols = {
    'α':'alpha','β':'beta','γ':'gamma','δ':'delta','ε':'varepsilon','ϵ':'epsilon',
    'ζ':'zeta','η':'eta','θ':'theta','ϑ':'vartheta','ι':'iota','κ':'kappa','λ':'lambda',
    'μ':'mu','ν':'nu','ξ':'xi','π':'pi','ϖ':'varpi','ρ':'rho','ϱ':'varrho','σ':'sigma',
    'ς':'varsigma','τ':'tau','υ':'upsilon','φ':'varphi','ϕ':'phi','χ':'chi','ψ':'psi','ω':'omega',
    'Γ':'Gamma','Δ':'Delta','Θ':'Theta','Λ':'Lambda','Ξ':'Xi','Π':'Pi','Σ':'Sigma',
    'Υ':'Upsilon','Φ':'Phi','Ψ':'Psi','Ω':'Omega','∂':'partial','∇':'nabla',
    '∞':'infty','±':'pm','∓':'mp','×':'times','÷':'div','·':'cdot','⋅':'cdot','∗':'ast',
    '≤':'le','≥':'ge','≠':'ne','≈':'approx','≡':'equiv','≅':'cong','≃':'simeq',
    '≪':'ll','≫':'gg','∝':'propto','∼':'sim','≍':'asymp','≺':'prec','≻':'succ',
    '∈':'in','∉':'notin','∋':'ni','⊂':'subset','⊃':'supset','⊆':'subseteq','⊇':'supseteq',
    '⊄':'nsubset','⊅':'nsupset','⊈':'nsubseteq','⊉':'nsupseteq','∪':'cup','∩':'cap',
    '∅':'emptyset','∀':'forall','∃':'exists','∄':'nexists','¬':'neg','∧':'land','∨':'lor',
    '→':'to','←':'leftarrow','↔':'leftrightarrow','⇒':'Rightarrow','⇐':'Leftarrow',
    '⇔':'Leftrightarrow','↦':'mapsto','↑':'uparrow','↓':'downarrow','↗':'nearrow',
    '↘':'searrow','⟶':'longrightarrow','⟵':'longleftarrow','⟷':'longleftrightarrow',
    '⟹':'Longrightarrow','⟺':'Longleftrightarrow','∑':'sum','∏':'prod','∐':'coprod',
    '∫':'int','∬':'iint','∭':'iiint','∮':'oint','⋃':'bigcup','⋂':'bigcap',
    '⋁':'bigvee','⋀':'bigwedge','⨁':'bigoplus','⨂':'bigotimes','⊕':'oplus','⊗':'otimes',
    '⊙':'odot','⊥':'perp','∥':'parallel','∣':'mid','∤':'nmid','∦':'nparallel','∠':'angle',
    '△':'triangle','□':'square','⋄':'diamond','…':'ldots','⋯':'cdots','⋮':'vdots','⋱':'ddots',
    'ℓ':'ell','ℏ':'hbar','ℜ':'Re','ℑ':'Im','℘':'wp','ℵ':'aleph','ℶ':'beth',
    '′':'prime','″':'doubleprime','‴':'tripleprime',
    '⌊':'lfloor','⌋':'rfloor','⌈':'lceil','⌉':'rceil','⟨':'langle','⟩':'rangle',
    'ℂ':'mathbb{C}','ℍ':'mathbb{H}','ℕ':'mathbb{N}','ℙ':'mathbb{P}','ℚ':'mathbb{Q}',
    'ℝ':'mathbb{R}','ℤ':'mathbb{Z}','ℬ':'mathcal{B}','ℰ':'mathcal{E}','ℱ':'mathcal{F}',
    'ℋ':'mathcal{H}','ℐ':'mathcal{I}','ℒ':'mathcal{L}','ℳ':'mathcal{M}','ℛ':'mathcal{R}',
    'ℭ':'mathfrak{C}','ℌ':'mathfrak{H}','ℨ':'mathfrak{Z}'
  };
  const functions = new Set('sin cos tan cot sec csc sinh cosh tanh coth arcsin arccos arctan log ln exp lim limsup liminf max min sup inf det gcd ker dim arg deg hom Pr'.split(' '));
  const accents = {
    '\u0302':'hat','^':'hat','ˆ':'hat','\u0303':'tilde','~':'tilde','˜':'tilde',
    '\u0304':'bar','¯':'bar','\u0305':'overline','‾':'overline','\u0307':'dot','˙':'dot',
    '\u0308':'ddot','¨':'ddot','\u030c':'check','ˇ':'check','\u0306':'breve','˘':'breve',
    '\u0300':'grave','`':'grave','\u0301':'acute','´':'acute','\u20d7':'vec','→':'vec',
    '\u20d6':'overleftarrow','←':'overleftarrow','⏞':'overbrace','⏟':'underbrace',
    '⏜':'overparen','⏝':'underparen','\u20db':'dddot','\u20dc':'ddddot'
  };
  const supers = {'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁺':'+','⁻':'-','⁼':'=','⁽':'(','⁾':')','ⁿ':'n','ⁱ':'i'};
  const subs = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','₊':'+','₋':'-','₌':'=','₍':'(','₎':')','ₐ':'a','ₑ':'e','ₒ':'o','ₓ':'x','ₕ':'h','ₖ':'k','ₗ':'l','ₘ':'m','ₙ':'n','ₚ':'p','ₛ':'s','ₜ':'t','ᵢ':'i','ᵣ':'r','ᵤ':'u','ᵥ':'v','ⱼ':'j','ᵦ':'β','ᵧ':'γ','ᵨ':'ρ','ᵩ':'φ','ᵪ':'χ'};
  const mathStyles = [
    [0x1d400,0x1d433,'mathbf'],[0x1d434,0x1d467,'mathit'],[0x1d468,0x1d49b,'boldsymbol'],
    [0x1d49c,0x1d4cf,'mathcal'],[0x1d4d0,0x1d503,'boldsymbol'],[0x1d504,0x1d537,'mathfrak'],
    [0x1d538,0x1d56b,'mathbb'],[0x1d56c,0x1d59f,'boldsymbol'],[0x1d5a0,0x1d5d3,'mathsf'],
    [0x1d5d4,0x1d607,'boldsymbol'],[0x1d608,0x1d63b,'mathsf'],[0x1d63c,0x1d66f,'boldsymbol'],
    [0x1d670,0x1d6a3,'mathtt'],[0x1d6a8,0x1d6e1,'boldsymbol'],[0x1d6e2,0x1d71b,'mathit'],
    [0x1d71c,0x1d755,'boldsymbol'],[0x1d756,0x1d78f,'boldsymbol'],[0x1d790,0x1d7c9,'boldsymbol'],
    [0x1d7ce,0x1d7d7,'mathbf'],[0x1d7d8,0x1d7e1,'mathbb'],[0x1d7e2,0x1d7eb,'mathsf'],
    [0x1d7ec,0x1d7f5,'mathbf'],[0x1d7f6,0x1d7ff,'mathtt']
  ];
  const local = node => (node.localName || node.nodeName || '').split(':').pop();
  const elements = node => Array.from(node.childNodes || []).filter(n => n.nodeType === 1);
  const child = (node, name) => elements(node).find(n => local(n) === name);
  const kids = (node, name) => elements(node).filter(n => local(n) === name);
  const attr = (node, name) => {
    if (!node) return null;
    for (const a of Array.from(node.attributes || [])) if (local(a) === name) return a.value;
    return null;
  };
  const value = (node, name, fallback = '') => {
    const property = child(node || {},name);
    return property ? attr(property,'val') ?? '' : fallback;
  };
  const enabled = (node,name) => {
    const property = child(node || {},name);
    return Boolean(property && (attr(property,'val') === null || truth(attr(property,'val'))));
  };
  const truth = v => v === '1' || v === 'true' || v === 'on';
  const clean = text => String(text || '').replace(/\u200b|\ufeff/g, '').replace(/\u2212|\u2013/g, '-');
  const texText = s => String(s).replace(/[\\{}%#$&_~^]/g, c => ({'\\':'\\textbackslash{}','~':'\\textasciitilde{}','^':'\\textasciicircum{}'}[c] || '\\' + c));
  function warn(ctx, message) { ctx.warnings.add(message); }
  function textMath(input, ctx, inStyle = false) {
    let result = '';
    const chars = Array.from(clean(input));
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (Object.hasOwn(supers, c) || Object.hasOwn(subs, c)) {
        const map = Object.hasOwn(supers, c) ? supers : subs;
        let run = map[c];
        while (i + 1 < chars.length && Object.hasOwn(map, chars[i + 1])) run += map[chars[++i]];
        result += (map === supers ? '^' : '_') + '{' + textMath(run, ctx) + '}';
      } else if (Object.hasOwn(symbols, c)) {
        if (c === '″') result += '\\prime\\prime ';
        else if (c === '‴') result += '\\prime\\prime\\prime ';
        else result += '\\' + symbols[c] + ' ';
      } else if (c.codePointAt(0) >= 0x1d400 && c.codePointAt(0) <= 0x1d7ff) {
        const normal = c.normalize('NFKC');
        const style = mathStyles.find(x => c.codePointAt(0) >= x[0] && c.codePointAt(0) <= x[1]);
        if (style && normal !== c) {
          const code = c.codePointAt(0);
          let mapped = textMath(normal, ctx, true).trim();
          // Compound Unicode alphabets preserve both family and weight/slant.
          if (code >= 0x1d4d0 && code <= 0x1d503) mapped = '\\mathcal{' + mapped + '}';
          if (code >= 0x1d56c && code <= 0x1d59f) mapped = '\\mathfrak{' + mapped + '}';
          if (code >= 0x1d5d4 && code <= 0x1d607 || code >= 0x1d63c && code <= 0x1d66f || code >= 0x1d756 && code <= 0x1d7c9) mapped = '\\mathsf{' + mapped + '}';
          if (code >= 0x1d608 && code <= 0x1d63b) mapped = '\\mathit{' + mapped + '}';
          result += inStyle ? mapped : '\\' + style[2] + '{' + mapped + '}';
        } else { result += c; warn(ctx, '有无法映射的数学字体字符，请核对结果。'); }
      } else if (/\s/.test(c)) result += ' ';
      else if (c === '\u2061' || c === '\u2062') result += ' ';
      else if (c === '\u2063') result += ',';
      else if (c === '\u2064') result += '+';
      else if (c === '√') { result += '\\surd '; warn(ctx, '孤立的根号未包含根式范围，请核对或使用结构化公式。'); }
      else if ('{}%#$&_'.includes(c)) result += '\\' + c;
      else if (c === '\\') result += '\\backslash ';
      else if (c === '^') result += '\\hat{}';
      else if (c === '~') result += '\\sim ';
      else if (c === '°') result += '^{\\circ}';
      else if (/\p{Mark}/u.test(c)) { result += c; warn(ctx, '存在单独的组合符号，请核对重音或向量标记。'); }
      else result += c;
    }
    return result;
  }
  function formatStyle(content, style, ctx) {
    const commands = {normal:'mathrm',bold:'mathbf',italic:'mathit','bold-italic':'boldsymbol',
      'double-struck':'mathbb',script:'mathcal',fraktur:'mathfrak','sans-serif':'mathsf',monospace:'mathtt'};
    if (!style || style === 'italic') return content;
    if (commands[style]) return '\\' + commands[style] + '{' + content.trim() + '}';
    if (style === 'bold-script') return '\\boldsymbol{\\mathcal{' + content.trim() + '}}';
    if (style === 'bold-fraktur') return '\\boldsymbol{\\mathfrak{' + content.trim() + '}}';
    if (style === 'bold-sans-serif') return '\\boldsymbol{\\mathsf{' + content.trim() + '}}';
    if (style === 'sans-serif-italic') return '\\mathsf{\\mathit{' + content.trim() + '}}';
    if (style === 'sans-serif-bold-italic') return '\\boldsymbol{\\mathsf{\\mathit{' + content.trim() + '}}}';
    warn(ctx, '数学字体样式“' + style + '”暂未转换，已保留其内容。');
    return content;
  }
  function scriptBase(base) {
    const s = base.trim();
    return /^(?:[\p{L}\p{N}]|\\[a-zA-Z]+(?:\{[^{}]*\})?)$/u.test(s) ? s : '{' + s + '}';
  }
  function scripts(base, sub, sup) {
    return scriptBase(base) + (sub ? '_{' + sub.trim() + '}' : '') + (sup ? '^{' + sup.trim() + '}' : '');
  }
  function delimiter(value) {
    const delimiters = {'':'','.':'.','(':'(',')':')','[':'[',']':']','{':'\\{','}':'\\}',
      '|':'|','‖':'\\Vert','∥':'\\Vert','∣':'|','⟨':'\\langle','⟩':'\\rangle','〈':'\\langle','〉':'\\rangle',
      '⌊':'\\lfloor','⌋':'\\rfloor','⌈':'\\lceil','⌉':'\\rceil','/':'/','\\':'\\backslash',
      '↑':'\\uparrow','↓':'\\downarrow','↕':'\\updownarrow','⇑':'\\Uparrow','⇓':'\\Downarrow','⇕':'\\Updownarrow'};
    return Object.hasOwn(delimiters, value) ? delimiters[value] || '.' : null;
  }
  function fences(open, content, close, ctx) {
    const left = delimiter(open), right = delimiter(close);
    if (left !== null && right !== null) return '\\left' + left + ' ' + content.trim() + ' \\right' + right;
    warn(ctx, '自定义括号按普通数学符号输出，请核对显示。');
    return textMath(open, ctx) + content + textMath(close, ctx);
  }
  function accent(base, mark, under, ctx) {
    let command = accents[mark];
    if (under && (command === 'bar' || command === 'overline')) command = 'underline';
    if (under && command === 'overbrace') command = 'underbrace';
    if (command === 'overparen' || command === 'underparen') {
      warn(ctx, '弧形组符号使用上/下标替代，请核对显示。'); command = null;
    }
    if (command && (!under || command === 'underline' || command === 'underbrace')) return '\\' + command + '{' + base.trim() + '}';
    return '\\' + (under ? 'underset' : 'overset') + '{' + textMath(mark, ctx).trim() + '}{' + base.trim() + '}';
  }
  function mathml(node, ctx) {
    const name = local(node), list = elements(node), render = n => n ? mathml(n, ctx) : '';
    const all = () => list.map(render).join('');
    const at = i => render(list[i]).trim();
    const arity = {mfrac:2,mroot:2,msub:2,msup:2,msubsup:3,mover:2,munder:2,munderover:3};
    if (arity[name] && list.length !== arity[name]) warn(ctx,'MathML 节点“' + name + '”的参数数量异常，请核对原公式。');
    switch (name) {
      case 'math': case 'mrow': case 'mtd': return all();
      case 'semantics': {
        const display = list.find(n => !['annotation','annotation-xml'].includes(local(n)));
        if (display) return render(display);
        const annotation = list.find(n => local(n) === 'annotation' && /(?:tex|latex)/i.test(attr(n,'encoding') || ''));
        if (annotation) return stripDelimiters(annotation.textContent);
        warn(ctx, 'MathML 语义节点缺少可转换的表示。'); return '';
      }
      case 'annotation': case 'annotation-xml': return '';
      case 'mi': case 'mn': case 'mo': {
        const s = node.textContent || '';
        let output = functions.has(s.trim()) ? '\\' + s.trim() + ' ' : textMath(s, ctx);
        if (attr(node, 'mathvariant')) output = formatStyle(output, attr(node,'mathvariant'), ctx);
        return output;
      }
      case 'mtext': case 'ms': return '\\text{' + texText(node.textContent || '') + '}';
      case 'mspace': {
        const width = attr(node,'width') || '';
        if (/^0(?:\.0+)?(?:em|ex|px|pt)?$/.test(width)) return '';
        if (/^(?:very)?negative/.test(width) || /^-/.test(width)) return '\\!';
        if (/^[1-9]\d*(?:\.\d+)?em$/.test(width)) return '\\quad ';
        return '\\, ';
      }
      case 'mfrac': {
        const thickness = attr(node,'linethickness');
        if (thickness && /^0(?:\.0+)?(?:px|pt|em|ex|%)?$/.test(thickness)) return '\\genfrac{}{}{0pt}{}{' + at(0) + '}{' + at(1) + '}';
        return '\\frac{' + at(0) + '}{' + at(1) + '}';
      }
      case 'msqrt': return '\\sqrt{' + all().trim() + '}';
      case 'mroot': return '\\sqrt[' + at(1) + ']{' + at(0) + '}';
      case 'msub': return scripts(at(0), at(1), '');
      case 'msup': return scripts(at(0), '', at(1));
      case 'msubsup': return scripts(at(0), at(1), at(2));
      case 'mover': case 'munder': {
        const under = name === 'munder';
        const mark = list[1]?.textContent?.trim() || '';
        if (truth(attr(node,under ? 'accentunder' : 'accent')) || Object.hasOwn(accents,mark)) return accent(at(0),mark,under,ctx);
        return '\\' + (under ? 'underset' : 'overset') + '{' + at(1) + '}{' + at(0) + '}';
      }
      case 'munderover': return '\\underset{' + at(1) + '}{\\overset{' + at(2) + '}{' + at(0) + '}}';
      case 'mfenced': {
        const separators = Array.from((attr(node,'separators') ?? ',').replace(/\s/g,''));
        const content = list.map((n,i) => (i && separators.length ? textMath(separators[Math.min(i-1,separators.length-1)],ctx) : '') + render(n)).join('');
        return fences(attr(node,'open') ?? '(', content, attr(node,'close') ?? ')', ctx);
      }
      case 'mtable': {
        const rows = list.filter(n => ['mtr','mlabeledtr'].includes(local(n)));
        if (rows.some(n => local(n) === 'mlabeledtr')) warn(ctx, '带标签的 MathML 表格保留了标签列，请核对排列。');
        return '\\begin{matrix}' + rows.map(n => elements(n).map(render).join(' & ')).join(' \\\\ ') + '\\end{matrix}';
      }
      case 'mtr': case 'mlabeledtr': return list.map(render).join(' & ');
      case 'mmultiscripts': {
        let prescript = list.findIndex(n => local(n) === 'mprescripts');
        if (prescript < 0) prescript = list.length;
        let post = '', pre = '';
        for (let i=1; i<prescript; i+=2) post += (i>1 ? '{}' : '') + (at(i) ? '_{' + at(i) + '}' : '') + (i+1<prescript && at(i+1) ? '^{' + at(i+1) + '}' : '');
        for (let i=prescript+1; i<list.length; i+=2) pre += '{}' + (at(i) ? '_{' + at(i) + '}' : '') + (at(i+1) ? '^{' + at(i+1) + '}' : '');
        return pre + scriptBase(at(0)) + post;
      }
      case 'none': case 'mprescripts': return '';
      case 'mstyle': return formatStyle(all(), attr(node,'mathvariant'), ctx);
      case 'mphantom': return '\\phantom{' + all() + '}';
      case 'menclose': {
        const notation = (attr(node,'notation') || 'longdiv').split(/\s+/);
        let result = all();
        for (const type of notation) {
          const cmd = {box:'boxed',roundedbox:'boxed',top:'overline',bottom:'underline',updiagonalstrike:'cancel',downdiagonalstrike:'bcancel',horizontalstrike:'cancel'}[type];
          if (cmd) result = '\\' + cmd + '{' + result + '}';
          else warn(ctx, 'MathML 边框样式“' + type + '”暂未转换，已保留其内容。');
        }
        return result;
      }
      case 'mpadded':
        warn(ctx,'MathML 的自定义间距未完全保留，公式内容已保留。'); return all();
      case 'maction': {
        warn(ctx,'交互式 MathML 仅转换当前选中的表达式。');
        return render(list[Math.max(0,(Number(attr(node,'selection')) || 1)-1)] || list[0]);
      }
      case 'merror': warn(ctx,'源 MathML 含有错误标记，请核对公式。'); return all();
      case 'mglyph': warn(ctx,'MathML 含有图像字形，无法恢复对应公式。'); return '\\text{[图像字形]}';
      default:
        warn(ctx,'暂不支持 MathML 节点“' + name + '”，已尽量保留其内容。');
        return list.length ? all() : textMath(node.textContent || '',ctx);
    }
  }
  function omml(node, ctx) {
    const name = local(node), list = elements(node), render = n => n ? omml(n,ctx) : '';
    const renderChild = name => render(child(node,name)).trim();
    const all = () => list.filter(n => !local(n).endsWith('Pr') && !['ctrlPr','proofErr','bookmarkStart','bookmarkEnd'].includes(local(n))).map(render).join('');
    const props = child(node,name+'Pr');
    if (name.endsWith('Pr') || ['ctrlPr','proofErr','bookmarkStart','bookmarkEnd','lastRenderedPageBreak'].includes(name)) return '';
    switch (name) {
      case 'oMath': case 'oMathPara': case 'e': case 'num': case 'den': case 'deg': case 'sub': case 'sup': case 'lim': case 'fName': return all();
      case 'r': {
        const rpr = list.find(n=>local(n)==='rPr' && n.namespaceURI===OMML) || child(node,'rPr');
        const raw = kids(node,'t').map(n => n.textContent || '').join('');
        if (enabled(rpr,'nor')) return '\\mathrm{' + textMath(raw,ctx).trim() + '}';
        if (enabled(rpr,'lit')) return '\\text{' + texText(raw) + '}';
        let result = all();
        const scr = value(rpr,'scr'), sty = value(rpr,'sty');
        const families = {roman:'normal',script:'script',fraktur:'fraktur','double-struck':'double-struck','sans-serif':'sans-serif',monospace:'monospace'};
        if (scr && scr !== 'roman') result = formatStyle(result,families[scr] || scr,ctx);
        if (sty === 'b' || sty === 'bi') result = formatStyle(result,sty === 'b' && !scr ? 'bold' : 'bold-italic',ctx);
        else if (sty === 'p') result = formatStyle(result,'normal',ctx);
        return result;
      }
      case 't': return textMath(node.textContent || '',ctx);
      case 'f': {
        const type = value(props,'type');
        if (type === 'noBar') return '\\genfrac{}{}{0pt}{}{' + renderChild('num') + '}{' + renderChild('den') + '}';
        return '\\frac{' + renderChild('num') + '}{' + renderChild('den') + '}';
      }
      case 'rad': {
        const degree = enabled(props,'degHide') ? '' : renderChild('deg');
        return '\\sqrt' + (degree ? '[' + degree + ']' : '') + '{' + renderChild('e') + '}';
      }
      case 'sSup': return scripts(renderChild('e'),'',renderChild('sup'));
      case 'sSub': return scripts(renderChild('e'),renderChild('sub'),'');
      case 'sSubSup': return scripts(renderChild('e'),renderChild('sub'),renderChild('sup'));
      case 'sPre': return '{}' + (renderChild('sub') ? '_{' + renderChild('sub') + '}' : '') + (renderChild('sup') ? '^{' + renderChild('sup') + '}' : '') + renderChild('e');
      case 'nary': {
        const chr = value(props,'chr','∫');
        let operator = textMath(chr,ctx).trim();
        if (value(props,'limLoc') === 'undOvr') operator += '\\limits';
        const sub = enabled(props,'subHide') ? '' : renderChild('sub');
        const sup = enabled(props,'supHide') ? '' : renderChild('sup');
        return operator + (sub ? '_{' + sub + '}' : '') + (sup ? '^{' + sup + '}' : '') + ' ' + renderChild('e');
      }
      case 'd': {
        const open = value(props,'begChr','('), close = value(props,'endChr',')'), sep = value(props,'sepChr','|');
        const join = delimiter(sep);
        const content = kids(node,'e').map(render).join(join && delimiter(open) !== null && delimiter(close) !== null ? ' \\middle' + join + ' ' : textMath(sep,ctx));
        return fences(open,content,close,ctx);
      }
      case 'm': return '\\begin{matrix}' + kids(node,'mr').map(row => kids(row,'e').map(render).join(' & ')).join(' \\\\ ') + '\\end{matrix}';
      case 'mr': return kids(node,'e').map(render).join(' & ');
      case 'eqArr': return '\\begin{gathered}' + kids(node,'e').map(render).join(' \\\\ ') + '\\end{gathered}';
      case 'acc': return accent(renderChild('e'),value(props,'chr','\u0302'),false,ctx);
      case 'bar': return '\\' + (value(props,'pos','top') === 'bot' ? 'underline' : 'overline') + '{' + renderChild('e') + '}';
      case 'groupChr': {
        const below = value(props,'pos','bot') === 'bot';
        const chr = value(props,'chr','⏟');
        return accent(renderChild('e'),chr,below,ctx);
      }
      case 'func': {
        const fn = child(node,'fName');
        const raw = (fn?.textContent || '').trim();
        let name = functions.has(raw) ? '\\' + raw : renderChild('fName');
        if (/^[A-Za-z]+$/.test(raw) && !functions.has(raw)) name = '\\operatorname{' + raw + '}';
        return name + ' ' + renderChild('e');
      }
      case 'limLow': return '\\underset{' + renderChild('lim') + '}{' + renderChild('e') + '}';
      case 'limUpp': return '\\overset{' + renderChild('lim') + '}{' + renderChild('e') + '}';
      case 'borderBox': return '\\boxed{' + renderChild('e') + '}';
      case 'box': return renderChild('e');
      case 'phant':
        if (enabled(props,'show')) { warn(ctx,'幻影公式的自定义尺寸未保留。'); return renderChild('e'); }
        return '\\phantom{' + renderChild('e') + '}';
      case 'br': return ' ';
      case 'aln': case 'alnScr': return '';
      default:
        warn(ctx,'暂不支持 Word 公式节点“' + name + '”，已尽量保留其内容。');
        return list.length ? all() : textMath(node.textContent || '',ctx);
    }
  }
  function parseXml(source) {
    if (/<!ENTITY\b|<!DOCTYPE\b/i.test(source)) throw new Error('不支持带 DTD / ENTITY 的 XML。请只粘贴公式 XML。');
    const doc = new DOMParser().parseFromString(source,'application/xml');
    if (doc.getElementsByTagName('parsererror').length || local(doc.documentElement) === 'parsererror') return null;
    return doc;
  }
  function decodeNamedEntities(source) {
    return source.replace(/&([a-zA-Z][a-zA-Z0-9]+);/g,(entity,name) => {
      if (['amp','lt','gt','quot','apos'].includes(name)) return entity;
      const decoded = new DOMParser().parseFromString('<body>' + entity + '</body>','text/html').body.textContent;
      return decoded !== entity ? decoded.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : entity;
    });
  }
  function formulaRoots(doc) {
    return Array.from(doc.getElementsByTagName('*')).filter(node => {
      if (!['math','oMath'].includes(local(node))) return false;
      let p = node.parentElement;
      while (p) { if (['math','oMath'].includes(local(p))) return false; p = p.parentElement; }
      return true;
    });
  }
  function extractRoots(input,ctx) {
    let source = input.replace(/^\s*<\?xml[^>]*\?>/i,'');
    if (/<!DOCTYPE\s+html\b/i.test(source)) source = source.replace(/<!DOCTYPE\s+html[^>]*>/i,'');
    const valid = parseXml(source);
    if (valid) {
      const roots = formulaRoots(valid);
      if (roots.length) return roots;
    }
    const fragments = [];
    // Word puts OMML inside conditional comments. Extract only formula elements;
    // copied HTML, its scripts, images, and event handlers are never inserted.
    const pattern = /<(?:([A-Za-z_][\w.-]*):)?(oMath|math)\b[^>]*>[\s\S]*?<\/(?:\1:)?\2\s*>/gi;
    let match;
    while ((match = pattern.exec(source))) fragments.push(match[0]);
    if (!fragments.length) return [];
    const roots = [];
    for (const fragment of fragments) {
      const prefixes = new Set(['m','w','mml','math']);
      for (const token of fragment.matchAll(/(?:<\/?|\s)([A-Za-z_][\w.-]*):[\w.-]+/g)) if (!['xml','xmlns'].includes(token[1])) prefixes.add(token[1]);
      let declarations = '';
      for (const prefix of prefixes) declarations += ' xmlns:' + prefix + '="' + (prefix === 'w' ? WORD : /mml|math/.test(prefix) ? MATHML : OMML) + '"';
      const parsed = parseXml('<root' + declarations + '>' + decodeNamedEntities(fragment) + '</root>');
      if (!parsed) throw new Error('公式 XML 不完整或格式不合法。请重新复制完整公式，或导入 .docx 文件。');
      roots.push(...formulaRoots(parsed));
    }
    return roots;
  }
  function stripDelimiters(input) {
    const value = String(input).trim();
    if (value.startsWith('$$') && value.endsWith('$$')) return value.slice(2,-2).trim();
    if (value.startsWith('\\[') && value.endsWith('\\]') || value.startsWith('\\(') && value.endsWith('\\)')) return value.slice(2,-2).trim();
    if (value.startsWith('$') && value.endsWith('$')) return value.slice(1,-1).trim();
    return value;
  }
  function checkLatex(latex,ctx) {
    let depth = 0;
    for (let i=0; i<latex.length; i++) {
      if (latex[i] === '\\') { i++; continue; }
      if (latex[i] === '{') depth++;
      if (latex[i] === '}') depth--;
      if (depth < 0) break;
    }
    if (depth !== 0) warn(ctx,'LaTeX 花括号不配对，请检查输入。');
  }
  function plainMath(input,ctx) {
    warn(ctx,'当前是纯文本转换：无法恢复 Word 丢失的分式、矩阵或上下标结构。请核对结果；复杂公式建议导入 .docx。');
    let value = clean(input).trim();
    // A deliberately limited syntax: balanced groups after ^/_ and sqrt(...).
    // Division remains a slash; silently choosing a fraction scope is unsafe.
    let result = '';
    function groupAt(start) {
      const opener = value[start], closer = {'(':')','{':'}','[':']'}[opener];
      if (!closer) return null;
      let depth = 1;
      for (let i=start+1;i<value.length;i++) {
        if (value[i] === opener) depth++;
        if (value[i] === closer && --depth === 0) return {inner:value.slice(start+1,i),end:i+1};
      }
      return null;
    }
    for (let i=0;i<value.length;) {
      if (value[i] === '^' || value[i] === '_') {
        const marker = value[i++];
        while (/\s/.test(value[i] || '') && i<value.length) i++;
        const group = groupAt(i);
        if (group) { result += marker + '{' + plainMathFragment(group.inner,ctx) + '}'; i=group.end; }
        else {
          const rest = value.slice(i), match = /^(?:[+-]?\d+(?:\.\d+)?|[\p{L}\p{N}])/u.exec(rest);
          if (match) { result += marker + '{' + textMath(match[0],ctx).trim() + '}'; i += match[0].length; }
          else { result += marker === '_' ? '\\_' : '\\hat{}'; warn(ctx,'有缺少内容的上/下标标记。'); }
        }
      } else if (value.startsWith('sqrt(',i) || value.startsWith('√(',i)) {
        const group = groupAt(i + (value[i] === '√' ? 1 : 4));
        if (group) { result += '\\sqrt{' + plainMathFragment(group.inner,ctx) + '}'; i=group.end; }
        else { result += textMath(value[i],ctx); i++; }
      } else {
        const rest = value.slice(i), word = /^(?:limsup|liminf|arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|cot|sec|csc|log|ln|exp|lim|max|min|det)\b/.exec(rest);
        if (word) { result += '\\' + word[0] + ' '; i += word[0].length; continue; }
        const c = String.fromCodePoint(value.codePointAt(i));
        if (Object.hasOwn(supers,c) || Object.hasOwn(subs,c)) {
          const map = Object.hasOwn(supers,c) ? supers : subs;
          let run = '';
          while (i<value.length) { const next=String.fromCodePoint(value.codePointAt(i)); if (!Object.hasOwn(map,next)) break; run += map[next]; i += next.length; }
          result += (map === supers ? '^' : '_') + '{' + textMath(run,ctx).trim() + '}';
        } else { result += textMath(c,ctx); i+=c.length; }
      }
    }
    if (/[▒■█⒜⒝⒞ⓜⓢ]/u.test(value)) warn(ctx,'检测到 Word UnicodeMath 的特殊结构标记，当前未能完整解析。请导入 .docx 以保留结构。');
    return result;
  }
  function plainMathFragment(input,ctx) { return plainMath(input,ctx).trim(); }
  function convert(input,kind = 'auto') {
    if (typeof input !== 'string' || !input.trim()) throw new Error('请先粘贴一个公式，或导入 .docx 文件。');
    if (input.length > 12_000_000) throw new Error('公式内容过大，请减少粘贴内容或拆分文档。');
    const ctx = {warnings:new Set()};
    let source = input.trim();
    const hasMathMarkup = /<(?:[\w.-]+:)?(?:math|oMath)\b/i.test(source);
    if (hasMathMarkup || ['omml','mathml'].includes(kind)) {
      const roots = extractRoots(source,ctx);
      if (!roots.length) throw new Error('没有找到完整的 MathML / Word 公式。请重新复制公式，或导入 .docx 文件。');
      const equations = roots.map(node => ({latex:(local(node) === 'oMath' ? omml(node,ctx) : mathml(node,ctx)).replace(/[ \t]+/g,' ').trim(),source:local(node) === 'oMath' ? 'OMML' : 'MathML'}));
      if (equations.some(eq => !eq.latex)) warn(ctx,'部分公式没有可转换的内容，请核对原文。');
      const formats = [...new Set(equations.map(eq=>eq.source))];
      return {equations,format:formats.join(' / '),warnings:[...ctx.warnings]};
    }
    if (kind === 'html' || /<\/?(?:html|body|p|span|div|img|table|br)\b/i.test(source)) {
      // Template content is inert, including image loading. It is never inserted.
      const template = document.createElement('template');
      template.innerHTML = source;
      const fragment = template.content;
      fragment.querySelectorAll('script,style,link,meta,iframe,object,noscript').forEach(n=>n.remove());
      if (fragment.querySelector('img,svg,canvas')) warn(ctx,'剪贴板中含有图片；本工具不进行图片识别，图片中的公式不会转换。');
      fragment.querySelectorAll('br').forEach(n=>n.replaceWith('\n'));
      fragment.querySelectorAll('p,div,li,tr').forEach(n=>n.append('\n'));
      source = (fragment.textContent || '').trim();
      if (!source) throw new Error('浏览器只收到了图片，无法恢复公式结构。请导入原始 .docx 文件，或在 Word 中切换为 LaTeX 后复制。');
    }
    const likelyLatex = kind === 'latex' || /\\(?:[A-Za-z]+|[()[\]])/.test(source) || /^(?:\$[^]*\$)$/.test(source);
    if (likelyLatex) {
      const latex = stripDelimiters(source);
      checkLatex(latex,ctx);
      return {equations:[{latex,source:'LaTeX'}],format:'LaTeX',warnings:[...ctx.warnings]};
    }
    const latex = plainMath(source,ctx).replace(/[ \t]+/g,' ').trim();
    return {equations:[{latex,source:'Unicode / 文本'}],format:'Unicode / 文本',warnings:[...ctx.warnings]};
  }
  global.WordLatex = Object.freeze({convert});
})(typeof window !== 'undefined' ? window : globalThis);
