import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { extname } from 'node:path';
import { PRODUCT_PHOTOS } from '../js/product-photos.js';

// A single file for previews and double-click use. No server, npm install,
// external libraries, fonts, or network connection are required for the demo.
const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
let html = await read('index.html');
const [styles, themes, fridge, theme, domain, catalog, productPhotosModule, fridgeModule, googleStore, store, app, mark, productImages] = await Promise.all([
  read('styles.css'), read('themes.css'), read('fridge.css'), read('theme.js'), read('js/domain.js'), read('js/catalog.js'), read('js/product-photos.js'), read('js/fridge.js'), read('js/google-store.js'), read('js/store.js'), read('js/app.js'), readFile(new URL('assets/holdwin-mark.png', root)),
  Promise.all(PRODUCT_PHOTOS.filter((photo) => photo.enabled !== false).map(async ({ src }) => {
    const mime = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }[extname(src).toLowerCase()];
    if (!mime || !/^\.\/assets\/[A-Za-z0-9_./-]+$/.test(src) || src.split('/').includes('..')) throw new Error(`Unsupported local product image: ${src}`);
    const bytes = await readFile(new URL(src, root));
    return { src, dataUrl: `data:${mime};base64,${bytes.toString('base64')}` };
  })),
]);
const stripModule = (code) => code.replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
const inline = [stripModule(domain), stripModule(catalog), stripModule(productPhotosModule), 'const h = escapeHtml;', stripModule(fridgeModule), stripModule(googleStore), stripModule(store), stripModule(app)].join('\n');
const syntax = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: inline, encoding: 'utf8' });
if (syntax.status !== 0) throw new Error(`Standalone demo module failed syntax validation: ${syntax.stderr}`);
html = html
  .replaceAll('./assets/holdwin-mark.png', `data:image/png;base64,${mark.toString('base64')}`)
  .replace('  <link rel="stylesheet" href="./styles.css">', () => `<style>\n${styles}\n${themes}\n${fridge}\n</style>`)
  .replace('  <link rel="stylesheet" href="./themes.css">', '')
  .replace('  <link rel="stylesheet" href="./fridge.css">', '')
  .replace('  <script src="./theme.js"></script>', `<script>\n${theme}\n</script>`)
  .replace('  <script src="./config.js"></script>', '<script>window.DRINKS_CONFIG = {};</script>')
  .replace('  <script type="module" src="./js/app.js"></script>', () => `<script type="module">\n${inline}\n</script>`);
for (const { src, dataUrl } of productImages) html = html.replaceAll(src, dataUrl);
await writeFile(new URL('demo.html', root), html);
console.log('Built demo.html — self-contained, local-only, no external requests.');
