# md2pdf-cli — Smoke Test

This is a **sample** Markdown document used by the smoke test.

## Features

- GitHub-flavored Markdown
- Tables, lists, code blocks
- Page numbers in the footer

### Table

| Tool      | Purpose          |
|-----------|------------------|
| marked    | Markdown parser  |
| puppeteer | Headless Chrome  |

### Code

```js
const { convert } = require('md2pdf-cli');
convert({ input: 'in.md', output: 'out.pdf' });
```

> If you can read this in a PDF, the smoke test passed.

### Equations

Inline: Euler's identity is $e^{i\pi} + 1 = 0$.

Display:

$$
\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}
$$

$$
\mathbf{y} = \sigma\!\left(\mathbf{W}\mathbf{x} + \mathbf{b}\right)
$$

