const test = require('node:test');
const assert = require('node:assert/strict');

const { createNetLogger } = require('../src/modules/net-logger.js');

test('net logger records metadata by default and marks logout responses', async () => {
  const logger = createNetLogger({ maxEntries: 3 });
  logger.onBeforeRequest({
    requestId: '1',
    url: 'https://www.zhipin.com/wapi/test',
    method: 'POST',
    timeStamp: 1000,
    requestBody: { formData: { phone: ['13800138000'] } }
  });
  logger.onCompleted({
    requestId: '1',
    url: 'https://www.zhipin.com/wapi/test',
    method: 'POST',
    statusCode: 401,
    timeStamp: 1300,
    responseHeaders: [{ name: 'content-type', value: 'application/json' }]
  });

  const snapshot = logger.snapshot();
  assert.equal(snapshot.length, 1);
  assert.equal(snapshot[0].status, 401);
  assert.equal(snapshot[0].duration, 300);
  assert.equal(snapshot[0]._logout, true);
  assert.equal(snapshot[0].reqBody, undefined);
});

test('net logger restores the persisted snapshot after a service worker restart', async () => {
  const store = {
    __bhpNetLog: {
      reason: 'logout',
      time: '2026-06-17T01:05:00.000Z',
      entries: [
        { ts: '01:05:00.000', method: 'GET', status: 401, duration: 125, url: 'https://www.zhipin.com/wapi/test', _logout: true },
        { ts: '01:05:01.000', method: 'GET', status: 200, duration: 40, url: 'https://www.zhipin.com/wapi/next' }
      ]
    }
  };
  const fakeChrome = {
    storage: {
      local: {
        async get(key) {
          return { [key]: store[key] };
        }
      }
    }
  };
  const logger = createNetLogger({ chrome: fakeChrome, maxEntries: 1 });

  await logger.restore();
  const snapshot = logger.snapshot();

  assert.equal(snapshot.length, 1);
  assert.equal(snapshot[0].url, 'https://www.zhipin.com/wapi/next');
  assert.equal(snapshot[0].status, 200);
});
