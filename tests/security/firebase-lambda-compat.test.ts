import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('Firebase in the Lambda module runtime', () => {
  it('loads Auth and verifies a real RSA key with synchronous ESM loading disabled', () => {
    const result = execFileSync(process.execPath, ['--no-experimental-require-module', '-e', `
      const assert = require('node:assert/strict');
      const { generateKeyPairSync } = require('node:crypto');
      require('firebase-admin/auth');
      const jwks = require('jwks-rsa');
      const jwt = require('jsonwebtoken');
      (async () => {
        const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
        const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'fixture', alg: 'RS256', use: 'sig' };
        const client = jwks({ jwksUri: 'https://unused.invalid/jwks', getKeysInterceptor: async () => [jwk] });
        const key = await client.getSigningKey('fixture');
        const signed = jwt.sign({ sub: 'fixture-user' }, privateKey, { algorithm: 'RS256', expiresIn: '1m' });
        assert.equal(jwt.verify(signed, key.getPublicKey(), { algorithms: ['RS256'] }).sub, 'fixture-user');
        const parts = signed.split('.');
        parts[1] = Buffer.from(JSON.stringify({ sub: 'other-user' })).toString('base64url');
        assert.throws(() => jwt.verify(parts.join('.'), key.getPublicKey(), { algorithms: ['RS256'] }));
        const passport = jwks.passportJwtSecret({ jwksUri: 'https://unused.invalid/jwks' });
        await new Promise((resolve, reject) => passport({}, 'invalid', (error, key) => {
          if (error) reject(error); else { assert.equal(key, null); resolve(); }
        }));
        console.log('verified');
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `], { encoding: 'utf8', timeout: 15000 });
    expect(result.trim()).toBe('verified');
  });
});
