// Génère des pages autonomes (CSS + JS intégrés) qui s'ouvrent par double-clic.
// Usage : node build.mjs   (après avoir modifié les fichiers de source/)
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = dirname(fileURLToPath(import.meta.url));
const out = join(src, '..');
const safe = (code) => code.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(join(src, 'css/style.css'), 'utf8');
const qr = readFileSync(join(src, 'js/vendor/qrcode.js'), 'utf8');

for (const page of ['index', 'host', 'play']) {
  let html = readFileSync(join(src, `${page}.html`), 'utf8');
  const entry = html.match(/<script type="module" src="([^"]+)"><\/script>/)[1];
  const res = await build({ entryPoints: [join(src, entry)], bundle: true, format: 'esm', write: false, target: 'es2022', logLevel: 'error' });
  html = html
    .replace('<link rel="stylesheet" href="css/style.css">', () => `<style>\n${css}\n</style>`)
    .replace('<script src="js/vendor/qrcode.js"></script>', () => `<script>\n${safe(qr)}\n</script>`)
    .replace(/<script type="module" src="[^"]+"><\/script>/, () => `<script type="module">\n${safe(res.outputFiles[0].text)}\n</script>`);
  writeFileSync(join(out, `${page}.html`), html);
  console.log(`✓ ${page}.html`);
}
