// Temporary compatibility fix for https://github.com/auth0/node-jwks-rsa/issues/507.
// Keep jose 6 and its verification behavior; use supported asynchronous ESM imports.
// Fail closed if upstream files change. Remove after the upstream fix ships.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const root = path.dirname(require.resolve('jwks-rsa/package.json'));
const hash = value => createHash('sha256').update(value).digest('hex');
const patches = [{"file": "src/utils.js", "before": "c535773fd798202296e846e7c057f96f631148686194ff2990f0729fa4c1b7af", "after": "f1ffe481947f3de681f1b37418208dab0968bbbd20eb12a544b5276642f6c9e2", "replacements": [["const jose = require('jose');\n", ""], ["async function retrieveSigningKeys(jwks) {\n", "async function retrieveSigningKeys(jwks) {\n  const jose = await import('jose');\n"]]}, {"file": "src/integrations/passport.js", "before": "03557fac70296dda6d19872b1702d2b8f1d4c50d22d3fbcf1fb65f9afa7ddcbb", "after": "e0973f23e42c0f71a834317c5458228a92e38eeb6c2ba325ba43377c6ff7f03e", "replacements": [["const jose = require('jose');\n", ""], ["return function secretProvider(req, rawJwtToken, cb) {\n", "return async function secretProvider(req, rawJwtToken, cb) {\n    let jose;\n    try { jose = await import('jose'); } catch (err) { cb(err, null); return; }\n"]]}];
for (const patch of patches) {
  const file = path.join(root, patch.file);
  let source = readFileSync(file, 'utf8');
  if (hash(source) === patch.after) continue;
  if (hash(source) !== patch.before) throw new Error('Review jwks-rsa compatibility patch before updating dependencies');
  for (const [before, after] of patch.replacements) source = source.replace(before, after);
  if (hash(source) !== patch.after) throw new Error('Unexpected patched jwks-rsa content');
  writeFileSync(file, source);
}
