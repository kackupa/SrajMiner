import assert from 'node:assert/strict';
import { onlineSignInErrorMessage } from '../src/game/online/AuthClient';

assert.match(onlineSignInErrorMessage('#error=access_denied&error_code=otp_expired') ?? '', /expired or was already used/i);
assert.match(onlineSignInErrorMessage('#error=access_denied&error_code=other') ?? '', /could not be completed/i);
assert.equal(onlineSignInErrorMessage('#access_token=private-token'), null);
assert.equal(onlineSignInErrorMessage('#'), null);
console.log('PASS online Auth callback: expired link has safe copy; token fragment is ignored');
