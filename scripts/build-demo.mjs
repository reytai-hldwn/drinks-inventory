import { readFile, realpath, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, extname, isAbsolute, join, basename, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCT_PHOTOS } from '../js/product-photos.js';
import { createCompanyData } from '../js/catalog.js';
import { applyInitialStocktake } from '../js/domain.js';

// A single file for previews and double-click use. No server, npm install,
// external libraries, fonts, or network connection are required for the demo.
const root = new URL('../', import.meta.url);
const argumentsList = process.argv.slice(2);
let output = new URL('demo.html', root);
let previewConfig = {};
if (argumentsList.length) {
  if (argumentsList.length !== 4 || argumentsList[0] !== '--stocktake' || argumentsList[2] !== '--output') throw new Error('Usage: --stocktake private.json --output /private/path/demo.html');
  const sourcePath = await realpath(resolve(argumentsList[1]));
  const outputPath = resolve(argumentsList[3]);
  const actualOutput = await realpath(outputPath).catch(async (error) => {
    if (error.code !== 'ENOENT') throw error;
    return join(await realpath(dirname(outputPath)), basename(outputPath));
  });
  const outsideRepository = (path) => { const relation = relative(fileURLToPath(root), path); return relation.startsWith('..' + '/') || isAbsolute(relation); };
  if (!outsideRepository(sourcePath) || !outsideRepository(actualOutput)) throw new Error('Private snapshots and their preview output must stay outside the repository.');
  const snapshot = JSON.parse(await readFile(sourcePath, 'utf8'));
  if (snapshot.pendingConfirmations?.length || snapshot.items?.some((item) => item.requiresConfirmation)) throw new Error('The snapshot still needs confirmation.');
  previewConfig = { initialStocktake: { snapshotId: snapshot.snapshotId, countedAt: snapshot.countedAt, countedAtApproximate: snapshot.countedAtApproximate === true, items: snapshot.items?.map(({ id, quantity }) => ({ id, quantity })) } };
  applyInitialStocktake(createCompanyData(), previewConfig.initialStocktake);
  output = outputPath;
}
const read = (path) => readFile(new URL(path, root), 'utf8');
let html = await read('index.html');
const [styles, themes, fridge, pantry, theme, domain, inventoryActivityModule, suppliesModule, restockPreferencesModule, catalog, productPhotosModule, wishSupportModule, drinkLabelsModule, drinkInformationModule, fridgeModule, googleWriteModule, googleStore, store, app, mark, productImages] = await Promise.all([
  read('styles.css'), read('themes.css'), read('fridge.css'), read('pantry.css'), read('theme.js'), read('js/domain.js'), read('js/inventory-activity.js'), read('js/supplies.js'), read('js/restock-preferences.js'), read('js/catalog.js'), read('js/product-photos.js'), read('js/wish-support.js'), read('js/drink-labels.js'), read('js/drink-information.js'), read('js/fridge.js'), read('js/google-write.js'), read('js/google-store.js'), read('js/store.js'), read('js/app.js'), readFile(new URL('assets/holdwin-mark-small.webp', root)),
  Promise.all([...PRODUCT_PHOTOS.filter((photo) => photo.enabled !== false).flatMap(photo => [{ src: photo.src }, { src: photo.displaySrc }]), { src: './assets/holdwin-icon.png' }, { src: './assets/pantry-mobile.webp' }, { src: './assets/pantry-coffee.webp' }, { src: './assets/pantry-office-wide.webp' }, { src: './assets/pantry-office-portrait.webp' }, { src: './assets/pantry-ui.woff2' }, { src: './assets/pantry-hand-complete.woff2' }].map(async ({ src }) => {
    const mime = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.avif': 'image/avif', '.woff2': 'font/woff2' }[extname(src).toLowerCase()];
    if (!mime || !/^\.\/assets\/[A-Za-z0-9_./-]+$/.test(src) || src.split('/').includes('..')) throw new Error(`Unsupported local product image: ${src}`);
    const bytes = await readFile(new URL(src, root));
    return { src, dataUrl: `data:${mime};base64,${bytes.toString('base64')}` };
  })),
]);
// Offline previews keep the original single embedded fallback; only the website
// downloads small unicode-range shards for newly entered heading characters.
const previewPantry = pantry.replace(/\/\* PANTRY_FALLBACK_FONTS_START \*\/[\s\S]*?\/\* PANTRY_FALLBACK_FONTS_END \*\//,
  '@font-face{font-family:"Pantry Hand Complete";src:url(\'./assets/pantry-hand-complete.woff2\') format(\'woff2\');font-style:normal;font-weight:700;font-display:swap}');
const stripModule = (code) => code.replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
const previewProductPhotos = productPhotosModule.replace(/"src":("[^"]+")/g, (match, encoded) => {
  const photo = PRODUCT_PHOTOS.find(photo => photo.src === JSON.parse(encoded));
  return photo ? `${match},"displaySrc":${JSON.stringify(photo.displaySrc)}` : match;
});
const inline = [stripModule(domain), stripModule(inventoryActivityModule), stripModule(suppliesModule), stripModule(restockPreferencesModule), stripModule(catalog), stripModule(previewProductPhotos), 'const h = escapeHtml;', stripModule(wishSupportModule), stripModule(drinkLabelsModule), stripModule(drinkInformationModule), stripModule(fridgeModule), stripModule(googleWriteModule), stripModule(googleStore), stripModule(store), stripModule(app)].join('\n');
const syntax = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: inline, encoding: 'utf8' });
if (syntax.status !== 0) throw new Error(`Standalone demo module failed syntax validation: ${syntax.stderr}`);
html = html
  .replaceAll('./assets/holdwin-mark-small.webp', `data:image/webp;base64,${mark.toString('base64')}`)
  .replace(/\s*<link rel="(?:preconnect|modulepreload)"[^>]+>/g, '')
  .replace('  <link rel="stylesheet" href="./styles.css">', () => `<style>\n${styles}\n${themes}\n${fridge}\n${previewPantry}\n</style>`)
  .replace('  <link rel="stylesheet" href="./themes.css">', '')
  .replace('  <link rel="stylesheet" href="./fridge.css">', '')
  .replace('  <link rel="stylesheet" href="./pantry.css">', '')
  .replace('  <script src="./theme.js"></script>', `<script>\n${theme}\n</script>`)
  .replace('  <script src="./config.js"></script>', () => `<script>window.DRINKS_CONFIG = ${JSON.stringify(previewConfig).replaceAll('<', '\\u003c')};</script>`)
  .replace('  <script type="module" src="./js/app.js"></script>', () => `<script type="module">\n${inline}\n</script>`);
for (const { src, dataUrl } of productImages) html = html.replaceAll(src, dataUrl);
const fontLicense = (await read('assets/Pantry-Hand-OFL.txt')).replaceAll('-->', '--&gt;').replace(/[ \t]+$/gm, '');
html = html.replace('</head>', `<!-- Self-hosted LXGW WenKai TC heading font license:\n${fontLicense}\n-->\n</head>`);
await writeFile(output, html);
console.log('Built a self-contained local preview with no external requests.' + (previewConfig.initialStocktake ? ' Private stocktake included only in the external output.' : ''));
