// E2E launcher: post-processes the build's @shared/* aliases (which tsc does
// not rewrite) into relative paths, then loads the real main entry.
//
// The app's build emits require("@shared/constants") in dist/main/**.js and
// dist/preload/**.js. Node cannot resolve that without a post-build step
// like `tsc-alias`. This launcher patches the dist artifacts in-place and
// also installs a Module._resolveFilename shim as a belt-and-braces fallback
// for the main process. We DO NOT modify anything under src/.

const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const repoRoot = path.resolve(__dirname, '..', '..');
const mainDir = path.join(repoRoot, 'dist', 'main');
const preloadDir = path.join(repoRoot, 'dist', 'preload');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.isFile() && p.endsWith('.js')) out.push(p);
  }
  return out;
}

function rewriteAliases(rootDir, sharedDirAbs) {
  if (!fs.existsSync(rootDir) || !fs.existsSync(sharedDirAbs)) return;
  for (const file of walk(rootDir)) {
    let src = fs.readFileSync(file, 'utf8');
    if (!src.includes('@shared/')) continue;
    const fromDir = path.dirname(file);
    const rewritten = src.replace(/require\(["']@shared\/([^"')]+)["']\)/g, (_m, sub) => {
      const target = path.join(sharedDirAbs, sub);
      let rel = path.relative(fromDir, target).replace(/\\/g, '/');
      if (!rel.startsWith('.')) rel = './' + rel;
      return `require(${JSON.stringify(rel)})`;
    });
    if (rewritten !== src) fs.writeFileSync(file, rewritten);
  }
}

rewriteAliases(mainDir, path.join(mainDir, 'shared'));
rewriteAliases(preloadDir, path.join(preloadDir, 'shared'));

// Bundle the preload. The app uses sandbox: true in BrowserWindow, but its
// compiled preload still issues require("../shared/constants") — sandboxed
// preloads in Electron forbid arbitrary Node requires, so the preload fails
// to load entirely (window.api is never exposed). Inline the shared module
// into the preload file as a CommonJS-style local var so the preload only
// keeps require("electron") (which sandboxed preloads do allow).
function bundlePreload() {
  const preloadFile = path.join(mainDir, 'preload', 'preload.js');
  const sharedFile = path.join(mainDir, 'shared', 'constants.js');
  if (!fs.existsSync(preloadFile) || !fs.existsSync(sharedFile)) return;
  let preloadSrc = fs.readFileSync(preloadFile, 'utf8');
  if (preloadSrc.includes('/* @e2e-bundled */')) return; // idempotent
  const sharedSrc = fs.readFileSync(sharedFile, 'utf8');
  // Wrap shared module as a self-contained factory call that returns its exports.
  const shim =
    '/* @e2e-bundled */\n' +
    'const __sharedConstants = (function () {\n' +
    '  const exports = {};\n' +
    '  const module = { exports };\n' +
    sharedSrc + '\n' +
    '  return module.exports;\n' +
    '})();\n';
  preloadSrc = preloadSrc.replace(
    /require\(["']\.\.\/shared\/constants["']\)/g,
    '__sharedConstants',
  );
  fs.writeFileSync(preloadFile, shim + preloadSrc);
}
bundlePreload();

// tsc does not copy non-.ts assets to outDir. The migrations module loads
// schema.sql via fs.readFileSync; copy it alongside the compiled output.
const schemaSrc = path.join(repoRoot, 'src', 'main', 'db', 'schema.sql');
const schemaDst = path.join(mainDir, 'main', 'db', 'schema.sql');
if (fs.existsSync(schemaSrc)) {
  fs.mkdirSync(path.dirname(schemaDst), { recursive: true });
  fs.copyFileSync(schemaSrc, schemaDst);
}

// Belt-and-braces: also handle live requires in the main process.
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (typeof request === 'string' && request.startsWith('@shared/')) {
    const sub = request.slice('@shared/'.length);
    const inPreload = parent && parent.filename && parent.filename.includes(`${path.sep}dist${path.sep}preload${path.sep}`);
    const baseDir = path.join(inPreload ? preloadDir : mainDir, 'shared');
    return origResolve.call(this, path.join(baseDir, sub), parent, ...rest);
  }
  return origResolve.call(this, request, parent, ...rest);
};

require(path.join(mainDir, 'main', 'index.js'));
