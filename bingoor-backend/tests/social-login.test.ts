import './env';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { facebookLoginBody, googleLoginBody, instagramLoginBody } from '../src/validators/schemas';

test('native Google ID tokens and existing browser access tokens are accepted independently', () => {
  assert.equal(googleLoginBody.safeParse({ idToken: 'signed-google-id-token' }).success, true);
  assert.equal(googleLoginBody.safeParse({ accessToken: 'browser-access-token' }).success, true);
  assert.equal(googleLoginBody.safeParse({ idToken: '' }).success, false);
});

test('Facebook mobile code exchange cannot send credentials to an arbitrary callback', () => {
  const code = 'one-time-provider-code';
  assert.equal(facebookLoginBody.safeParse({ code, redirectUri: 'https://bingoor.com/auth/mobile/facebook' }).success, true);
  for (const redirectUri of ['https://attacker.example/callback', 'https://bingoor.com.attacker.example/auth/mobile/facebook', 'http://bingoor.com/auth/mobile/facebook']) {
    assert.equal(facebookLoginBody.safeParse({ code, redirectUri }).success, false);
  }
  assert.equal(facebookLoginBody.safeParse({ accessToken: 'existing-browser-token' }).success, true);
});

test('Instagram authorization codes remain separate from provider access tokens', () => {
  assert.equal(instagramLoginBody.safeParse({ accessToken: 'provider-access-token' }).success, false);
  assert.equal(instagramLoginBody.safeParse({ code: 'one-time-provider-code', redirectUri: 'https://bingoor.com/auth/mobile/instagram' }).success, true);
});
