/* Structural regressions: assert preserved math, independent of harmless whitespace. */
globalThis.wordLatexFixtures = (() => {
  const math = s => `<math xmlns="http://www.w3.org/1998/Math/MathML">${s}</math>`;
  const omml = s => `<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">${s}</m:oMath>`;
  const run = s => `<m:r><m:t>${s}</m:t></m:r>`;
  return [
    {name:'MathML fraction preserves grouping', input:math('<mfrac><mrow><mi>a</mi><mo>+</mo><mi>b</mi></mrow><mi>c</mi></mfrac>'), includes:['\\frac{a+b}{c}']},
    {name:'MathML indexed root preserves degree', input:math('<mroot><mi>x</mi><mn>3</mn></mroot>'), includes:['\\sqrt[3]{x}']},
    {name:'MathML nested fraction and square root', input:math('<msqrt><mfrac><mn>1</mn><mi>x</mi></mfrac></msqrt>'), includes:['\\sqrt{\\frac{1}{x}}']},
    {name:'MathML subscript and superscript', input:math('<msubsup><mi>x</mi><mi>i</mi><mn>2</mn></msubsup>'), includes:['_{i}','^{2}']},
    {name:'MathML matrix preserves rows and columns', input:math('<mtable><mtr><mtd><mi>a</mi></mtd><mtd><mi>b</mi></mtd></mtr><mtr><mtd><mi>c</mi></mtd><mtd><mi>d</mi></mtd></mtr></mtable>'), includes:['a&b','c&d','\\\\']},
    {name:'MathML Greek and relation symbols', input:math('<mi>α</mi><mo>≤</mo><mi>β</mi>'), includes:['\\alpha','\\le','\\beta']},
    {name:'MathML adjacent equations remain separate', input:math('<mi>x</mi>')+math('<mi>y</mi>'), count:2},
    {name:'MathML HTML named entities are decoded', input:'<html><body>'+math('<mi>&alpha;</mi><mo>&le;</mo><mi>x</mi>')+'</body></html>', includes:['\\alpha','\\le']},
    {name:'OMML fraction', input:omml('<m:f><m:num>'+run('a+b')+'</m:num><m:den>'+run('c')+'</m:den></m:f>'), includes:['\\frac{a+b}{c}']},
    {name:'OMML square root hidden degree', input:omml('<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>'+run('x')+'</m:e></m:rad>'), includes:['\\sqrt{x}']},
    {name:'OMML indexed root', input:omml('<m:rad><m:deg>'+run('3')+'</m:deg><m:e>'+run('x')+'</m:e></m:rad>'), includes:['\\sqrt[3]{x}']},
    {name:'OMML superscript preserves grouping', input:omml('<m:sSup><m:e>'+run('x')+'</m:e><m:sup>'+run('n+1')+'</m:sup></m:sSup>'), includes:['^{n+1}']},
    {name:'OMML subscript and superscript', input:omml('<m:sSubSup><m:e>'+run('x')+'</m:e><m:sub>'+run('i')+'</m:sub><m:sup>'+run('2')+'</m:sup></m:sSubSup>'), includes:['_{i}','^{2}']},
    {name:'OMML summation limits and body', input:omml('<m:nary><m:naryPr><m:chr m:val="∑"/></m:naryPr><m:sub>'+run('i=1')+'</m:sub><m:sup>'+run('n')+'</m:sup><m:e>'+run('i')+'</m:e></m:nary>'), includes:['\\sum','_{i=1}','^{n}']},
    {name:'OMML delimiter contents preserved', input:omml('<m:d><m:dPr><m:begChr m:val="["/><m:endChr m:val="]"/></m:dPr><m:e>'+run('a+b')+'</m:e></m:d>'), includes:['\\left[','a+b','\\right]']},
    {name:'OMML matrix preserves rows and columns', input:omml('<m:m><m:mr><m:e>'+run('a')+'</m:e><m:e>'+run('b')+'</m:e></m:mr><m:mr><m:e>'+run('c')+'</m:e><m:e>'+run('d')+'</m:e></m:mr></m:m>'), includes:['a&b','c&d','\\\\']},
    {name:'OMML Word HTML conditional comment', input:'<html><body><!--[if gte msEquation 12]>'+omml('<m:f><m:num>'+run('a')+'</m:num><m:den>'+run('b')+'</m:den></m:f>')+'<![endif]--><img src="unused.png"></body></html>', includes:['\\frac{a}{b}']},
    {name:'OMML undeclared prefix fragment recovery', input:'<m:oMath><m:sSup><m:e>'+run('x')+'</m:e><m:sup>'+run('2')+'</m:sup></m:sSup></m:oMath>', includes:['^{2}']},
    {name:'OMML paragraph equations are not duplicated', input:'<m:oMathPara xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">'+omml(run('x'))+omml(run('y'))+'</m:oMathPara>', count:2},
    {name:'Plain LaTeX passes through', input:'\\frac{a+b}{c}', includes:['\\frac{a+b}{c}']},
    {name:'Unknown MathML structure raises warning', input:math('<unsupported><mi>x</mi></unsupported>'), warning:true},
    {name:'Plain UnicodeMath fallback explains limitations', input:'x² + α ≤ β', includes:['\\alpha','\\beta'], warning:true}
  ];
})();

globalThis.runWordLatexRegressions = () => wordLatexFixtures.map(test => {
  try {
    const result = WordLatex.convert(test.input, 'auto');
    const joined = result.equations.map(e => e.latex).join('\n').replace(/\s/g, '');
    for (const text of test.includes || []) {
      if (!joined.includes(text.replace(/\s/g, ''))) throw new Error('Missing '+text+' in '+joined);
    }
    if (test.count !== undefined && result.equations.length !== test.count) throw new Error('Expected '+test.count+' equations, got '+result.equations.length);
    if (test.warning && !result.warnings.length) throw new Error('Missing approximation/unsupported warning');
    return {name:test.name, pass:true, output:joined};
  } catch (error) {
    return {name:test.name, pass:false, error:error.message};
  }
});
