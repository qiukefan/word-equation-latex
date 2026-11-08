import base64
import re
from pathlib import Path


def inline_katex_fonts(root):
    """Bundle the matching KaTeX stylesheet and fonts without runtime requests."""
    css = (root / 'vendor/katex.min.css').read_text()

    def inline_font_source(match):
        # Modern Mac browsers support WOFF2. Remove the separate WOFF/TTF
        # fallbacks so opening the single HTML never resolves sibling files.
        font = re.search(r'url\([\"\']?(fonts/[^)\"\']+\.woff2)[\"\']?\)', match[0])
        if font is None:
            raise ValueError('A KaTeX font declaration has no WOFF2 source')
        encoded = base64.b64encode((root / 'vendor' / font[1]).read_bytes()).decode('ascii')
        return 'src:url(data:font/woff2;base64,' + encoded + ') format("woff2");'

    css, font_count = re.subn(r'src:[^;}]+;?', inline_font_source, css)
    urls = re.findall(r'url\(([^)]+)\)', css)
    if font_count != 20 or any(not url.startswith('data:font/woff2;base64,') for url in urls):
        raise ValueError('Incomplete offline KaTeX font bundle')
    return css

root = Path(__file__).resolve().parent
html = (root / 'src/index.template.html').read_text()
icon = (root / 'assets/logo-icon.svg').read_bytes()
html = html.replace('LOGO_ICON_DATA_URI', 'data:image/svg+xml;base64,' + base64.b64encode(icon).decode('ascii'))
if '/* KATEX_CSS */' not in html:
    raise ValueError('The HTML template is missing its KaTeX stylesheet placeholder')
html = html.replace('/* KATEX_CSS */', inline_katex_fonts(root))
for marker, path in [
    ('I18N_BUNDLE', 'src/i18n.js'),
    ('KATEX_BUNDLE', 'vendor/katex.min.js'),
    ('FORMULA_FONTS_BUNDLE', 'src/formula-fonts.js'),
    ('MATHJAX_BUNDLE', 'vendor/mathjax-mml-svg.js'),
    ('IMAGE_EXPORT_BUNDLE', 'src/image-export.js'),
    ('FFLATE_BUNDLE', 'vendor/fflate.min.js'),
    ('CONVERTER_BUNDLE', 'src/converter.js'),
    ('DOCX_BUNDLE', 'src/docx.js'),
    ('APP_BUNDLE', 'src/app.js'),
]:
    code = (root / path).read_text().replace('</script', '<\\/script')
    html = html.replace('/* ' + marker + ' */', code)
licenses = '\n'.join((root / 'vendor' / p).read_text() for p in ['KATEX-LICENSE.txt', 'FFLATE-LICENSE.txt', 'MATHJAX-LICENSE.txt'])
html = html.replace('<!-- THIRD_PARTY_LICENSES -->', '<!-- Bundled libraries: KaTeX 0.16.22, fflate 0.8.3 and MathJax 3.2.2\n' + licenses.replace('--', '—') + '\n-->')
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist/index.html').write_text(html)
(root / 'Word公式转LaTeX.html').write_text(html)
# GitHub Pages serves only this self-contained public application from main /docs.
# Word files, test fixtures and other repository contents are never copied here.
(root / 'docs').mkdir(exist_ok=True)
(root / 'docs/index.html').write_text(html)
(root / 'docs/.nojekyll').write_text('')
print(f'Built standalone HTML: {len(html.encode()):,} bytes')
