import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isTokenRefreshing,
  computeCredentialHash,
  getValidToken,
  getTokenPresentationState
} from '../tokenManager.js';

describe('iSolarCloud Token Management & Reliability Suite', () => {
  test('1. Credential hash correctly detects credential changes without leaking secrets', () => {
    const creds1 = {
      appKey: 'app_key_1',
      secretKey: 'secret_key_1',
      userAccount: 'account_1',
      userPassword: 'secret_password_1',
      baseUrl: 'https://gateway.isolarcloud.com.hk'
    };
    const hash1 = computeCredentialHash(creds1);

    const creds2 = { ...creds1, userPassword: 'changed_password' };
    const hash2 = computeCredentialHash(creds2);

    assert.equal(typeof hash1, 'string');
    assert.equal(hash1.length, 64); // SHA-256 hex string
    assert.notEqual(hash1, hash2);
    // Ensure secrets are never present in the hash string
    assert.ok(!hash1.includes('secret_password_1'));
    assert.ok(!hash1.includes('secret_key_1'));
  });

  test('2. Mock mode returns valid simulation token immediately without vendor call', async () => {
    const prevMode = process.env.ISOLAR_MODE;
    process.env.ISOLAR_MODE = 'mock';

    try {
      const res = await getValidToken({ isLive: false });
      assert.equal(res.source, 'mock');
      assert.ok(res.token);
      assert.ok(res.expiresAt > Date.now());
    } finally {
      process.env.ISOLAR_MODE = prevMode;
    }
  });

  test('3. Static token environment override takes precedence when configured', async () => {
    const prevToken = process.env.ISOLAR_ACCESS_TOKEN;
    process.env.ISOLAR_ACCESS_TOKEN = 'test_static_bearer_token';

    try {
      const res = await getValidToken({ isLive: true });
      assert.equal(res.token, 'test_static_bearer_token');
      assert.equal(res.source, 'env_static');
    } finally {
      delete process.env.ISOLAR_ACCESS_TOKEN;
      if (prevToken) process.env.ISOLAR_ACCESS_TOKEN = prevToken;
    }
  });

  test('4. Token presentation state formats honest status and unambiguous date-time labels', async () => {
    const state = await getTokenPresentationState();
    assert.ok(state.tokenStatus === 'active' || state.tokenStatus === 'expired' || state.tokenStatus === 'refreshing');
    assert.ok(typeof state.tokenExpiresLabel === 'string');

    if (state.tokenStatus === 'active') {
      assert.match(state.tokenExpiresLabel, /^Aktif \(exp\. .+\d{2}\.\d{2} WIB\)$/);
    } else if (state.tokenStatus === 'expired') {
      assert.match(state.tokenExpiresLabel, /^Kedaluwarsa/);
    } else if (state.tokenStatus === 'refreshing') {
      assert.equal(state.tokenExpiresLabel, 'Memperbarui...');
    }
  });

  test('5. isTokenRefreshing reports accurate in-process singleton state', () => {
    assert.equal(typeof isTokenRefreshing(), 'boolean');
  });
});
