import { copyFile, lstat, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, extname, join, resolve } from 'node:path';
import { validateGoogleScriptUrl } from '../js/google-store.js';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const pages = ['index.html', 'styles.css', 'themes.css', 'fridge.css', 'theme.js'];
const assetTypes = new Set(['.png', '.svg', '.webp', '.avif', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2']);
const excludedDirectories = new Set(['tests', '__tests__', 'snapshots', '__snapshots__', 'docs', 'node_modules']);

export function sharedConfig(env = process.env) {
  if (env.DATA_PROVIDER === 'google' || env.GOOGLE_SCRIPT_URL || (!env.SUPABASE_URL && !env.SUPABASE_ANON_KEY && !env.SUPABASE_PUBLISHABLE_KEY)) {
    if (!env.GOOGLE_SCRIPT_URL?.trim()) throw new Error('GOOGLE_SCRIPT_URL is required for the shared Google Forms/Sheets site.');
    const googleScriptUrl = validateGoogleScriptUrl(env.GOOGLE_SCRIPT_URL);
    return { provider: 'google', mode: 'google', requireShared: true, googleScriptUrl };
  }
  const rawUrl = (env.SUPABASE_URL || '').trim();
  const key = (env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (!rawUrl || !key) {
    throw new Error('SUPABASE_URL and a public SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY) are required.');
  }

  let url;
  try { url = new URL(rawUrl); } catch { throw new Error('SUPABASE_URL must be a valid HTTPS project URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      url.pathname !== '/' || url.search || url.hash || !url.hostname.includes('.')) {
    throw new Error('SUPABASE_URL must be an HTTPS project origin without credentials, port, path, query, or fragment.');
  }

  // These are public browser keys. Decode legacy JWT metadata only to reject
  // privileged keys; this is not signature verification or a connectivity test.
  if (/^sb_secret_/i.test(key) || /service_role/i.test(key) || /\s/.test(key)) {
    throw new Error('Use only a public anon/publishable key; privileged or malformed keys are prohibited.');
  }
  if (key.split('.').length === 3) {
    let claims;
    try { claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')); }
    catch { throw new Error('The public Supabase key has malformed JWT metadata.'); }
    if (claims?.role !== 'anon') {
      throw new Error('The browser requires an anon/publishable key, never a service-role or user access token.');
    }
  }

  return { mode: 'shared', requireShared: true, supabaseUrl: url.origin, supabaseAnonKey: key };
}

export async function buildSite({ root = projectRoot, env = process.env } = {}) {
  // Validate before creating output. A missing config must never produce a
  // deployable local-demo bundle, including when a local config.js exists.
  const config = sharedConfig(env);
  const output = join(root, 'dist');
  const staging = join(root, `.dist-build-${randomUUID()}`);
  let copied = 0;

  async function copyStatic(source, target) {
    const stat = await lstat(source);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Static inputs must be regular files, not links.');
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
    copied += 1;
  }

  async function copyDirectory(name, relative = '') {
    const source = join(root, name, relative);
    const stat = await lstat(source);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Static directories must not be links.');
    const entries = await readdir(source, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name.startsWith('.') || excludedDirectories.has(entry.name)) continue;
      const item = join(relative, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Static inputs must not contain symbolic links.');
      if (entry.isDirectory()) { await copyDirectory(name, item); continue; }
      const included = name === 'js'
        ? extname(entry.name) === '.js' && !/\.(test|spec)\.js$/.test(entry.name)
        : assetTypes.has(extname(entry.name).toLowerCase());
      if (included) await copyStatic(join(root, name, item), join(staging, name, item));
    }
  }

  try {
    await mkdir(staging);
    for (const name of pages) await copyStatic(join(root, name), join(staging, name));
    await copyDirectory('js');
    await copyDirectory('assets');
    await writeFile(join(staging, 'config.js'),
      '// Generated production browser configuration. Public values only.\n' +
      `window.DRINKS_CONFIG = ${JSON.stringify(config, null, 2)};\n`);
    await writeFile(join(staging, '.nojekyll'), '');
    await rm(output, { recursive: true, force: true });
    await rename(staging, output);
    return { output, files: copied + 2 };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = await buildSite();
    console.log(`Built dist/ — shared production mode, ${result.files} static files. Public configuration values are not logged.`);
  } catch (error) {
    console.error(`Production build refused: ${error.message}`);
    process.exitCode = 1;
  }
}
