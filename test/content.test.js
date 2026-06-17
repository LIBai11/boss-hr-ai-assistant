const test = require('node:test');
const assert = require('node:assert/strict');

test('content page status includes detected BOSS login state from the page DOM', () => {
  const messages = [];
  const previousWindow = global.window;
  const previousDocument = global.document;
  const modulePath = require.resolve('../src/content/content.js');
  delete require.cache[modulePath];

  global.document = {
    title: 'BOSS 直聘',
    readyState: 'complete',
    querySelector(selector) {
      if (selector === 'a[ka="header-username"] .label-text') return { textContent: '赵六 HR' };
      if (selector === 'i.icon-vip, img.vip-icon-v2') return { textContent: '' };
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };
  global.window = {
    chrome: {
      runtime: {
        sendMessage(message) {
          messages.push(message);
        }
      }
    },
    location: { href: 'https://www.zhipin.com/web/chat/index' },
    addEventListener() {}
  };

  try {
    require(modulePath);
    const pageStatus = messages.find((message) => message.type === 'PAGE_STATUS');

    assert.equal(pageStatus.payload.bossStatus.loggedIn, true);
    assert.equal(pageStatus.payload.bossStatus.user, '赵六 HR');
    assert.equal(pageStatus.payload.bossStatus.vip, true);
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    delete require.cache[modulePath];
  }
});
