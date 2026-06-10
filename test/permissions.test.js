const test = require('node:test');
const assert = require('node:assert/strict');

const permissions = require('../src/modules/permissions.js');

test('BYO permission extracts HTTPS origin pattern and rejects unsafe URLs', () => {
  assert.deepEqual(permissions.byoPermissionFromUrl('https://api.example.com/v1/chat/completions'), {
    origin: 'https://api.example.com',
    pattern: 'https://api.example.com/*'
  });

  assert.throws(() => permissions.byoPermissionFromUrl('http://localhost:3000'), /https/);
  assert.throws(() => permissions.byoPermissionFromUrl('not-a-url'), /URL/);
});

test('requestByoPermission checks existing permission before requesting', async () => {
  const calls = [];
  const fakeChrome = {
    permissions: {
      contains(query, callback) {
        calls.push(['contains', query.origins]);
        callback(true);
      },
      request(query, callback) {
        calls.push(['request', query.origins]);
        callback(false);
      }
    }
  };

  assert.deepEqual(await permissions.requestByoPermission(fakeChrome, 'https://api.example.com/v1'), {
    granted: true,
    alreadyGranted: true,
    origin: 'https://api.example.com'
  });
  assert.deepEqual(calls, [['contains', ['https://api.example.com/*']]]);
});
