# md2pdf-cli

Convert Markdown files into beautifully styled PDFs using [marked](https://github.com/markedjs/marked), [KaTeX](https://katex.org/) and [puppeteer](https://github.com/puppeteer/puppeteer).

GitHub-flavored Markdown, tables, code blocks, blockquotes, images **and LaTeX math equations** (`$inline$` and `$$display$$`) are all rendered with sane, print-friendly defaults — page numbers in the footer, A4 by default, justified body text, and zebra-striped tables.

## Install

```bash
npm install -g md2pdf-cli
```

Or use it directly in a project:

```bash
npm install md2pdf-cli
```

## CLI

```bash
md2pdf <input.md> [output.pdf] [options]
```

If `output.pdf` is omitted, the output filename is derived from the input (e.g. `research.md` → `research.pdf`).

### Options

| Flag                   | Description                                                |
|------------------------|------------------------------------------------------------|
| `--title <text>`       | Document title (defaults to the input filename)            |
| `--css <file>`         | Path to a custom CSS file (replaces the default styles)    |
| `--format <size>`      | Page format: `A4`, `Letter`, `Legal`, ... Default: `A4`    |
| `--no-page-numbers`    | Disable the page-number footer                             |
| `--no-math`            | Disable KaTeX equation rendering                           |
| `--no-sanitize`        | Disable HTML sanitization (**unsafe**, see below)          |
| `--keep-html`          | Keep the intermediate `.tmp.html` file for debugging       |
| `-h`, `--help`         | Show usage                                                 |

### Examples

```bash
md2pdf research.md
md2pdf research.md out/research.pdf
md2pdf report.md report.pdf --title "Quarterly Report" --css theme.css
md2pdf notes.md notes.pdf --format Letter --no-page-numbers
md2pdf paper.md paper.pdf            # equations rendered by default
md2pdf draft.md draft.pdf --no-math  # treat $...$ as literal text
```

### Math / LaTeX equations

Inline math uses single dollars, display math uses double dollars:

```markdown
The famous identity is $e^{i\pi} + 1 = 0$.

$$
\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}
$$
```

Equations are rendered server-side with KaTeX, so the PDF is self-contained and prints identically on any machine.

## Security / HTML sanitization

Markdown allows raw HTML, which means an untrusted `.md` file can embed
`<script>`, `<iframe>`, or event-handler attributes (`onerror`, `onclick`, ...).
Because the document is rendered through a real browser (Chromium) before being
printed, such payloads would otherwise execute.

To prevent this, the HTML produced from your Markdown is **sanitized by default**
with [DOMPurify](https://github.com/cure53/DOMPurify) before it ever reaches the
browser. Scripts, event handlers, and dangerous URIs (`javascript:`, ...) are
stripped, while legitimate content — headings, tables, code blocks, images,
links and KaTeX/MathML/SVG math — is preserved.

If you fully trust the input and need to keep raw HTML (custom `<script>`,
embeds, etc.), you can opt out:

```bash
md2pdf trusted.md trusted.pdf --no-sanitize
```

```js
await convert({ input: 'trusted.md', output: 'trusted.pdf', sanitize: false });
```

> Only disable sanitization for content you control. Never run `--no-sanitize`
> on files from untrusted sources.

## Programmatic API

```js
const { convert } = require('md2pdf-cli');

await convert({
  input: 'research.md',
  output: 'research.pdf',
  title: 'My Research Report',
  // cssFile: 'theme.css',
  // css: '/* inline CSS string */',
  format: 'A4',
  pageNumbers: true,
  sanitize: true,
});
```

### `convert(options)`

| Option              | Type                          | Default                | Description                                            |
|---------------------|-------------------------------|------------------------|--------------------------------------------------------|
| `input`             | `string`                      | —                      | Path to a Markdown file (required)                     |
| `output`            | `string`                      | —                      | Path to the output PDF (required)                      |
| `title`             | `string`                      | input basename         | `<title>` of the generated HTML                        |
| `css`               | `string`                      | bundled default        | Inline CSS string                                      |
| `cssFile`           | `string`                      | —                      | Path to a CSS file (overrides `css`)                   |
| `format`            | `string`                      | `'A4'`                 | Puppeteer page format                                  |
| `margin`            | `object`                      | 22mm / 18mm            | `{ top, bottom, left, right }`                         |
| `pageNumbers`       | `boolean`                     | `true`                 | Render `n / total` in the footer                       |
| `math`              | `boolean`                     | `true`                 | Render `$...$` and `$$...$$` as KaTeX                  |
| `sanitize`          | `boolean`                     | `true`                 | Sanitize generated HTML (strip scripts/handlers)       |
| `headerTemplate`    | `string`                      | empty                  | Puppeteer header HTML                                  |
| `footerTemplate`    | `string`                      | page numbers           | Puppeteer footer HTML                                  |
| `puppeteerOptions`  | `object`                      | `{}`                   | Extra options passed to `puppeteer.launch`             |
| `keepHtml`          | `boolean`                     | `false`                | Keep the intermediate `.tmp.html` file                 |

Returns `{ output, brokenImages }` where `brokenImages` lists any `<img>` URLs that failed to load.

## Requirements

- Node.js >= 18
- Puppeteer will download a compatible Chromium on install (≈ 170 MB). To skip this and reuse an existing Chrome, set `PUPPETEER_SKIP_DOWNLOAD=true` before installing and pass `puppeteerOptions: { executablePath: '...' }` to `convert()`.

## License

MIT
