import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInNewContext } from 'node:vm';
import { buildSite, sharedConfig } from '../scripts/build-site.mjs';

const publicEnv = { SUPABASE_URL: 'https://pantry.example.supabase.co', SUPABASE_ANON_KEY: 'sb_publishable_test_public_key' };
const jwt = (role) => ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ role })).toString('base64url'), 'test-signature'].join('.');

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'pantry-production-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const folder of ['js', 'assets', 'docs', 'tests', 'supabase']) await mkdir(join(root, folder));
  for (const [path, value] of Object.entries({
    'index.html': '<!doctype html><script src="./config.js"></script><script type="module" src="./js/app.js"></script>',
    'styles.css': 'body{margin:0}', 'themes.css': ':root{color:gold}', 'fridge.css': '.fridge{}', 'pantry.css': '.pantry-stage{}',
    'theme.js': 'document.documentElement.dataset.theme="gold";', 'js/app.js': 'window.pantryReady=true;',
    'assets/holdwin-mark.png': 'fixture-png',
    'assets/pantry-hand.woff2': 'fixture-font', 'assets/Pantry-Hand-OFL.txt': 'fixture-font-license',
    'config.js': 'window.DRINKS_CONFIG={mode:"demo"};', 'demo.html': 'FAKE DEMO STOCK',
    'designs.html': 'ARCHIVED PROPOSALS', 'docs/snapshot.png': 'SCREENSHOT',
    'tests/private.test.mjs': 'TEST ONLY', 'supabase/schema.sql': 'SQL ONLY',
    'assets/notes.txt': 'NOT A STATIC ASSET', 'js/app.test.js': 'TEST ONLY',
  })) await writeFile(join(root, path), value);
  return root;
}

async function filesUnder(root, prefix = '') {
  const result = [];
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await filesUnder(root, path));
    else result.push(path);
  }
  return result.sort();
}

test('production artifact contains only runtime files and always generates shared browser configuration', async (t) => {
  const root = await fixture(t);
  const result = await buildSite({ root, env: publicEnv });
  assert.equal(result.output, join(root, 'dist'));
  assert.deepEqual(await filesUnder(result.output), [
    '.nojekyll', 'assets/holdwin-mark.png', 'assets/pantry-hand.woff2', 'assets/Pantry-Hand-OFL.txt', 'config.js', 'fridge.css', 'index.html',
    'js/app.js', 'pantry.css', 'styles.css', 'theme.js', 'themes.css',
  ].sort());
  assert.equal(result.files, 12);
  const context = { window: {} };
  runInNewContext(await readFile(join(result.output, 'config.js'), 'utf8'), context);
  assert.equal(context.window.DRINKS_CONFIG.mode, 'shared');
  assert.equal(context.window.DRINKS_CONFIG.requireShared, true);
  assert.equal(context.window.DRINKS_CONFIG.supabaseUrl, publicEnv.SUPABASE_URL);
  assert.equal(context.window.DRINKS_CONFIG.supabaseAnonKey, publicEnv.SUPABASE_ANON_KEY);
  assert.match(await readFile(join(root, 'config.js'), 'utf8'), /mode:"demo"/);
});

test('missing production configuration fails without publishing the source demo configuration', async (t) => {
  const root = await fixture(t);
  for (const env of [{}, { SUPABASE_URL: publicEnv.SUPABASE_URL }, { SUPABASE_ANON_KEY: publicEnv.SUPABASE_ANON_KEY }]) {
    await assert.rejects(buildSite({ root, env }), /required/);
  }
  assert.equal((await readdir(root)).includes('dist'), false);
  assert.equal((await readdir(root)).some((name) => name.startsWith('.dist-build-')), false);
});

test('privileged, user-session and malformed keys are rejected without exposing their values', () => {
  for (const key of ['sb_secret_do_not_publish', jwt('service_role'), jwt('authenticated'), 'bad.bad.bad', 'a key with spaces']) {
    assert.throws(() => sharedConfig({ ...publicEnv, SUPABASE_ANON_KEY: key }), (error) => {
      assert.equal(error.message.includes(key), false);
      return true;
    });
  }
});

test('project URLs must be secure origins without credentials or API paths', () => {
  for (const url of [
    'not-a-url', 'http://pantry.example.supabase.co', 'https://user:pass@example.com',
    'https://example.com/rest/v1', 'https://example.com?query=1', 'https://example.com/#fragment',
    'https://example.com:8443', 'https://localhost',
  ]) assert.throws(() => sharedConfig({ ...publicEnv, SUPABASE_URL: url }));
  assert.equal(sharedConfig({ ...publicEnv, SUPABASE_URL: publicEnv.SUPABASE_URL + '/' }).supabaseUrl, publicEnv.SUPABASE_URL);
});

test('legacy anon JWT and publishable-key environment names are accepted', () => {
  assert.equal(sharedConfig({ ...publicEnv, SUPABASE_ANON_KEY: jwt('anon') }).supabaseAnonKey, jwt('anon'));
  const config = sharedConfig({ SUPABASE_URL: publicEnv.SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_public_key' });
  assert.equal(config.supabaseAnonKey, 'sb_publishable_public_key');
  assert.equal(config.mode, 'shared');
});

test('rebuilding replaces old output without retaining accidentally copied demo artifacts', async (t) => {
  const root = await fixture(t);
  await buildSite({ root, env: publicEnv });
  await writeFile(join(root, 'dist/demo.html'), 'old unwanted demo artifact');
  await writeFile(join(root, 'styles.css'), 'body{color:gold}');
  await buildSite({ root, env: publicEnv });
  assert.equal((await readdir(join(root, 'dist'))).includes('demo.html'), false);
  assert.equal(await readFile(join(root, 'dist/styles.css'), 'utf8'), 'body{color:gold}');
  assert.equal((await readdir(root)).some((name) => name.startsWith('.dist-build-')), false);
});

test('releases bypass stale CSS and every cached module dependency without changing source files', async (t) => {
  const root = await fixture(t);
  const html = '<!doctype html><head><link rel="stylesheet" href="./pantry.css"><script src="./theme.js"></script><script src="./config.js"></script><script type="module" src="./js/app.js"></script></head>';
  const app = "import { hint } from './fridge.js';\nimport './domain.js';\nwindow.pantryReady = hint;";
  const fridge = "export { color } from './domain.js';\nexport const hint='new';";
  await writeFile(join(root, 'index.html'), html);
  await writeFile(join(root, 'js/app.js'), app);
  await writeFile(join(root, 'js/fridge.js'), fridge);
  await writeFile(join(root, 'js/domain.js'), "export const color='brown';");
  const first = await buildSite({ root, env: publicEnv });
  const check = async revision => {
    const built = await readFile(join(root, 'dist/index.html'), 'utf8');
    for (const name of ['pantry.css', 'theme.js', 'config.js', 'js/app.js']) assert.ok(built.includes(`./${name}?v=${revision}`));
    assert.ok(built.includes(`name="pantry-release" content="${revision}"`));
    const modules = await readFile(join(root, 'dist/js/app.js'), 'utf8');
    for (const name of ['fridge.js', 'domain.js']) assert.ok(modules.includes(`./${name}?v=${revision}`));
    assert.ok((await readFile(join(root, 'dist/js/fridge.js'), 'utf8')).includes(`./domain.js?v=${revision}`));
    assert.equal(await readFile(join(root, 'index.html'), 'utf8'), html);
    assert.equal(await readFile(join(root, 'js/app.js'), 'utf8'), app);
    assert.equal(await readFile(join(root, 'js/fridge.js'), 'utf8'), fridge);
  };
  await check(first.revision);
  assert.equal((await buildSite({ root, env: publicEnv })).revision, first.revision, 'identical source keeps the same cache key');
  await writeFile(join(root, 'pantry.css'), '.guide-arrow{stroke:brown}');
  const second = await buildSite({ root, env: publicEnv });
  assert.notEqual(second.revision, first.revision);await check(second.revision);
  await writeFile(join(root, 'js/domain.js'), "export const color='cream';");
  const third = await buildSite({ root, env: publicEnv });
  assert.notEqual(third.revision, second.revision);await check(third.revision);
  const configured = await buildSite({ root, env: { ...publicEnv, SUPABASE_URL: 'https://new.example.supabase.co' } });
  assert.notEqual(configured.revision, third.revision, 'public configuration changes also refresh the release');
});

test('symbolic links cannot smuggle arbitrary files into the production artifact', async (t) => {
  const root = await fixture(t);
  await symlink(join(root, 'supabase/schema.sql'), join(root, 'js/linked.js'));
  await assert.rejects(buildSite({ root, env: publicEnv }), /symbolic links/);
  assert.equal((await readdir(root)).includes('dist'), false);
  assert.equal((await readdir(root)).some((name) => name.startsWith('.dist-build-')), false);
});


test('Google production uses only a configured published script and never publishes private backend code', async (t) => {
  const root = await fixture(t);
  const endpoint = 'https://script.google.com/macros/s/company-pantry/exec';
  const result = await buildSite({ root, env: { DATA_PROVIDER: 'google', GOOGLE_SCRIPT_URL: endpoint } });
  const context = { window: {} };
  runInNewContext(await readFile(join(result.output, 'config.js'), 'utf8'), context);
  assert.equal(context.window.DRINKS_CONFIG.provider, 'google');
  assert.equal(context.window.DRINKS_CONFIG.googleScriptUrl, endpoint);
  assert.equal(context.window.DRINKS_CONFIG.requireShared, true);
  assert.equal('supabaseAnonKey' in context.window.DRINKS_CONFIG, false);
  assert.throws(() => sharedConfig({ DATA_PROVIDER: 'google', GOOGLE_SCRIPT_URL: 'https://example.com/exec' }));
  await assert.rejects(buildSite({ root, env: { DATA_PROVIDER: 'google' } }), /GOOGLE_SCRIPT_URL/);
});
