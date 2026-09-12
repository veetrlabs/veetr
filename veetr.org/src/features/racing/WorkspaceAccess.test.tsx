import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requireAccount} from './WorkspaceAccess';
test('queued mutations fail after sign-out or account switch', () => {
 assert.throws(() => requireAccount('', 'official'), /Sign in/);
 assert.throws(() => requireAccount('other', 'official'), /Sign in/);
 assert.doesNotThrow(() => requireAccount('official', 'official'));
});
