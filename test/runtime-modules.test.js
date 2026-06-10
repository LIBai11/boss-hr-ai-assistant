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
