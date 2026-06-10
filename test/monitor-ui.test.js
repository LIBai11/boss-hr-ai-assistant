const test = require('node:test');
const assert = require('node:assert/strict');

const CONFIGURED_BYO_SETTINGS = {
  byo: {
    url: 'https://api.example.com/v1',
    key: 'sk-test',
    model: 'gpt-test'
  }
};

function createElement(id = '') {
  const el = {
    id,
    attributes: {},
    checked: false,
    children: [],
    className: '',
    disabled: false,
    innerHTML: '',
    style: {},
    textContent: '',
    value: '',
    addEventListener(type, handler) {
      this[`on${type}`] = handler;
    },
    getAttribute(name) {
      return this.attributes[name] || null;
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    dispatchEvent(event) {
      const handler = this[`on${event?.type}`];
      if (handler) handler.call(this, event);
      return true;
    },
    focus() {
      this.focused = true;
    },
    scrollIntoView() {
      this.scrolled = true;
    },
    prepend(child) {
      this.children.unshift(child);
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    click() {
      this.clicked = true;
    },
    remove() {
      this.removed = true;
    }
  };
  el.classList = {
    add(...names) {
      const classes = new Set(el.className.split(/\s+/).filter(Boolean));
      names.forEach((name) => classes.add(name));
      el.className = Array.from(classes).join(' ');
    },
    remove(...names) {
      const remove = new Set(names);
      el.className = el.className.split(/\s+/).filter((name) => name && !remove.has(name)).join(' ');
    },
    toggle(name, force) {
      const classes = new Set(el.className.split(/\s+/).filter(Boolean));
      const shouldAdd = force === undefined ? !classes.has(name) : Boolean(force);
      if (shouldAdd) classes.add(name);
      else classes.delete(name);
      el.className = Array.from(classes).join(' ');
      return shouldAdd;
    },
    contains(name) {
      return el.className.split(/\s+/).includes(name);
    }
  };
  return el;
}

function setupMonitorHarness() {
  const handlers = {};
  const elements = new Map();
  const ids = [
    'logged-area',
    'actions-card',
    'stats-card-4',
    'btn-settings-hd',
    'boss-dot',
    'boss-ready',
    'byo-dot',
    'byo-ready',
    'byo-summary',
    'proactive-cap-ready',
    'settings-boss-dot',
    'settings-boss-ready',
    'settings-byo-dot',
    'settings-byo-ready',
    'settings-proactive-cap-ready',
    'account-name',
    'boss-user',
    'top-usage',
    'new-greet',
    'proactive-cap-count',
    'proactive-cap-line',
    'pause-banner',
    'pause-banner-text',
    'pause-resume-btn',
    'pause-clear-btn',
    'btn-stop',
    'btn-follow',
    'btn-proactive',
    'follow-options',
    'proactive-options',
    'btn-new',
    'btn-chat',
    'btn-smart',
    'btn-pro-followup',
    'btn-pro-greet',
    'btn-pro-smart',
    'status-card',
    'status',
    'run-mode-title',
    'run-mode-subtitle',
    'stat-processed',
    'stat-proactive',
    'stat-rated',
    'stat-top',
    'stat-business-failed',
    'log',
    'run-list',
    'run-count',
    'rating-results',
    'rating-count',
    'rating-dist',
    'rating-list-inline',
    'pipeline-card',
    'pipeline-cursor',
    'pipe-scan',
    'pipe-filter',
    'pipe-resume',
    'pipe-ai',
    'pipe-send',
    'pipe-record',
    'settings-overlay',
    'settings-back-btn',
    'settings-export-btn',
    'btn-daily-summary',
    'rating-toggle',
    'detail-overlay',
    'detail-back-btn',
    'detail-overlay-title',
    'detail-overlay-body',
    's-message-ai-generate',
    's-vip_filters_block',
    'btn-save-settings',
    'ai-template-modal',
    'ai-template-modal-title',
    'ai-template-modal-body',
    'ai-template-primary',
    'ai-template-secondary',
    's-byo-section',
    's-byo-url',
    's-byo-key',
    's-byo-model',
    's-byo-headers',
    's-debug-enabled',
    's-run-time-limit-minutes',
    's-run-time-limit-minutes-value',
    's-age-max',
    's-school-enabled',
    's-schools',
    's-company-enabled',
    's-companies',
    's-pro-age-max',
    's-pro-school-enabled',
    's-pro-schools',
    's-pro-company-enabled',
    's-pro-companies',
    's-thank-on-fail-enabled',
    's-invite-on-pass-enabled',
    's-reply-mode-reply',
    's-exchange-wechat-enabled',
    's-auto-download-log',
    's-msg-greeting',
    's-msg-thank',
    's-msg-contact',
    's-msg-contact-no-wechat',
    's-msg-job-closed',
    's-pro-followup-msg',
    's-rating-prompt',
    'settings-toast'
    ,
    's-vip_filters_refresh',
    's-vip_filters_hint',
    's-vip_major_options',
    's-vip_keyword1_options',
    's-vip_major_meta',
    's-vip_keyword1_meta',
    'debug-log-card',
    'debug-log',
    'btn-debug-pause',
    'btn-debug-clear',
    'sniffer-card',
    'sniffer-preset-filters',
    'sniffer-preset-cards',
    'sniffer-copy',
    'sniffer-clear',
    'sniffer-root',
    'sniffer-target',
    'sniffer-depth',
    'sniffer-max-roots',
    'sniffer-strip',
    'sniffer-run',
    'sniffer-status',
    'sniffer-output',
    'netlog-section',
    'btn-netlog-load',
    'btn-netlog-clear',
    'netlog-info',
    'netlog-list'
  ];
  ids.forEach((id) => elements.set(id, createElement(id)));
  elements.get('s-vip_filters_block').style.display = 'none';

  const documentListeners = {};
  const document = {
    documentElement: createElement('html'),
    addEventListener(type, handler) {
      documentListeners[type] = handler;
    },
    createElement: () => createElement(),
    getElementById: (id) => elements.get(id) || null
  };
  const api = {
    getSettings: async () => CONFIGURED_BYO_SETTINGS,
    getStatus: async () => ({
      boss: { loggedIn: true, user: '张三 HR', newGreetingCount: 2 },
      dailyUsage: { follow_runs: 1, proactive_runs: 0, proactive_resume_views: 7 },
      automation: { running: false }
    }),
    requestByoPermission: async () => ({ granted: true }),
    generateMessageTemplates: async () => ({ text: '{}' }),
    saveSettings: async (settings) => settings,
    startAuto: async () => 'started',
    stopAuto: async () => 'stopping',
    resumeAuto: async () => 'started',
    clearPauseState: async () => ({ ok: true }),
    byType: async () => null,
    on(type, handler) {
      handlers[type] = handler;
      return () => {};
    }
  };
  const window = {
    BHPPageApi: api,
    document,
    localStorage: { setItem() {} }
  };

  return { document, documentListeners, elements, handlers, window };
}

test('monitor UI listens to automation progress messages and renders snapshot stats', async () => {
  const harness = setupMonitorHarness();
  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousLocalStorage = global.localStorage;
  const previousRequestAnimationFrame = global.requestAnimationFrame;
  const modulePath = require.resolve('../src/ui/monitor/monitor.js');
  delete require.cache[modulePath];
  global.window = harness.window;
  global.document = harness.document;
  global.localStorage = harness.window.localStorage;
  global.requestAnimationFrame = (callback) => callback();
  try {
    require(modulePath);
    harness.documentListeners.DOMContentLoaded();
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(typeof harness.handlers.AUTO_PROGRESS, 'function');
    harness.handlers.AUTO_PROGRESS({
      text: '已处理 3，评级 2',
      snapshot: {
        running: true,
        stats: {
          processed: 3,
          rated: 2,
          greeted: 1,
          replied: 1
        }
      }
    });

    assert.equal(harness.elements.get('status').textContent, '已处理 3，评级 2');
    assert.equal(harness.elements.get('stat-processed').textContent, '3');
    assert.equal(harness.elements.get('stat-rated').textContent, '2');
    assert.equal(harness.elements.get('stat-proactive').textContent, '1');
    assert.equal(harness.elements.get('stat-top').textContent, '2');
    assert.equal(harness.elements.get('btn-stop').disabled, false);
    assert.match(harness.elements.get('log').children[0].innerHTML, /已处理 3，评级 2/);
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.localStorage = previousLocalStorage;
    global.requestAnimationFrame = previousRequestAnimationFrame;
    delete require.cache[modulePath];
  }
});

test('monitor renders snapshot process log and rating distribution', async () => {
  const harness = setupMonitorHarness();
  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousLocalStorage = global.localStorage;
  const previousRequestAnimationFrame = global.requestAnimationFrame;
  const modulePath = require.resolve('../src/ui/monitor/monitor.js');
  delete require.cache[modulePath];
  global.window = harness.window;
  global.document = harness.document;
  global.localStorage = harness.window.localStorage;
  global.requestAnimationFrame = (callback) => callback();
  try {
    require(modulePath);
    harness.documentListeners.DOMContentLoaded();
    await new Promise((resolve) => setImmediate(resolve));

    harness.handlers.AUTO_PROGRESS({
      snapshot: {
        running: true,
        processLog: [
          { time: '2026-06-10T00:02:00.000Z', kind: 'business_failure', candidateName: '张三', text: '学校不匹配' },
          { time: '2026-06-10T00:01:00.000Z', kind: 'system_failure', candidateName: '李四', text: 'AI timeout' }
        ],
        ratingResults: [
          { candidateId: 'c1', candidateName: '王五', rating: 'A', summary: '技术匹配' },
          { candidateId: 'c2', candidateName: '赵六', rating: 'C', summary: '经验不足' }
        ],
        stats: { processed: 2, rated: 2 }
      }
    });

    assert.match(harness.elements.get('run-list').innerHTML, /业务不通过/);
    assert.match(harness.elements.get('run-list').innerHTML, /张三/);
    assert.match(harness.elements.get('run-list').innerHTML, /系统失败/);
    assert.equal(harness.elements.get('run-count').textContent, '2');
    assert.notEqual(harness.elements.get('rating-results').style.display, 'none');
    assert.equal(harness.elements.get('rating-count').textContent, '2');
    assert.match(harness.elements.get('rating-dist').innerHTML, /A/);
    assert.match(harness.elements.get('rating-dist').innerHTML, /C/);
    assert.match(harness.elements.get('rating-list-inline').innerHTML, /王五/);
    assert.match(harness.elements.get('rating-list-inline').innerHTML, /经验不足/);
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.localStorage = previousLocalStorage;
    global.requestAnimationFrame = previousRequestAnimationFrame;
    delete require.cache[modulePath];
  }
});

test('monitor opens detail summaries for daily records and ratings', async () => {
  const harness = setupMonitorHarness();
  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousLocalStorage = global.localStorage;
  const previousRequestAnimationFrame = global.requestAnimationFrame;
  const modulePath = require.resolve('../src/ui/monitor/monitor.js');
  delete require.cache[modulePath];
  global.window = harness.window;
  global.document = harness.document;
  global.localStorage = harness.window.localStorage;
  global.requestAnimationFrame = (callback) => callback();
  try {
    require(modulePath);
    harness.documentListeners.DOMContentLoaded();
    await new Promise((resolve) => setImmediate(resolve));

    harness.handlers.AUTO_PROGRESS({
      snapshot: {
        running: true,
        processLog: [
          { time: '2026-06-10T00:02:00.000Z', kind: 'business_failure', candidateName: '张三', text: '学校不匹配' }
        ],
        ratingResults: [
          { candidateName: '王五', rating: 'A', summary: '技术匹配', risk: '无明显风险' }
        ],
        stats: { processed: 1, rated: 1 }
      }
    });

    harness.elements.get('btn-daily-summary').onclick();
    assert.equal(harness.elements.get('detail-overlay').style.display, 'flex');
    assert.match(harness.elements.get('detail-overlay-title').textContent, /今日记录/);
    assert.match(harness.elements.get('detail-overlay-body').innerHTML, /张三/);
    assert.match(harness.elements.get('detail-overlay-body').innerHTML, /学校不匹配/);

    harness.elements.get('rating-toggle').onclick();
    assert.match(harness.elements.get('detail-overlay-title').textContent, /简历评级/);
    assert.match(harness.elements.get('detail-overlay-body').innerHTML, /王五/);
    assert.match(harness.elements.get('detail-overlay-body').innerHTML, /技术匹配/);
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.localStorage = previousLocalStorage;
    global.requestAnimationFrame = previousRequestAnimationFrame;
    delete require.cache[modulePath];
  }
});

test('monitor renders list-level checkpoint pipeline', async () => {
  const harness = setupMonitorHarness();
  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousLocalStorage = global.localStorage;
  const previousRequestAnimationFrame = global.requestAnimationFrame;
  const modulePath = require.resolve('../src/ui/monitor/monitor.js');
  delete require.cache[modulePath];
  global.window = harness.window;
  global.document = harness.document;
  global.localStorage = harness.window.localStorage;
  global.requestAnimationFrame = (callback) => callback();
  try {
    require(modulePath);
    harness.documentListeners.DOMContentLoaded();
    await new Promise((resolve) => setImmediate(resolve));

    harness.handlers.AUTO_PROGRESS({
      snapshot: {
        running: true,
        checkpoint: { level: 'list', cursor: 3 },
        stats: {
          processed: 3,
          rated: 2,
          greeted: 1,
          replied: 0,
          businessFailed: 1
        }
      }
    });

    assert.notEqual(harness.elements.get('pipeline-card').style.display, 'none');
    assert.equal(harness.elements.get('pipeline-cursor').textContent, '列表检查点 3');
    assert.match(harness.elements.get('pipe-scan').className, /done/);
    assert.match(harness.elements.get('pipe-filter').className, /done/);
    assert.match(harness.elements.get('pipe-ai').className, /done/);
    assert.match(harness.elements.get('pipe-send').className, /done/);
    assert.match(harness.elements.get('pipe-record').className, /active/);
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.localStorage = previousLocalStorage;
    global.requestAnimationFrame = previousRequestAnimationFrame;
    delete require.cache[modulePath];
  }
});

test('monitor disables start actions while running', async () => {
  const harness = setupMonitorHarness();
  harness.window.BHPPageApi.getStatus = async () => ({
    boss: { loggedIn: true, user: '张三 HR', newGreetingCount: 2 },
    dailyUsage: { follow_runs: 1, proactive_runs: 1, proactive_resume_views: 12 },
    automation: { running: true, lastText: '运行中' }
  });
  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousLocalStorage = global.localStorage;
  const previousRequestAnimationFrame = global.requestAnimationFrame;
  const modulePath = require.resolve('../src/ui/monitor/monitor.js');
  delete require.cache[modulePath];
  global.window = harness.window;
  global.document = harness.document;
  global.localStorage = harness.window.localStorage;
  global.requestAnimationFrame = (callback) => callback();
  try {
    require(modulePath);
    harness.documentListeners.DOMContentLoaded();
    await new Promise((resolve) => setImmediate(resolve));

    for (const id of ['btn-follow', 'btn-proactive', 'btn-new', 'btn-chat', 'btn-smart', 'btn-pro-followup', 'btn-pro-greet', 'btn-pro-smart']) {
      assert.equal(harness.elements.get(id).disabled, true, id);
    }
    assert.equal(harness.elements.get('btn-stop').disabled, false);
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.localStorage = previousLocalStorage;
    global.requestAnimationFrame = previousRequestAnimationFrame;
    delete require.cache[modulePath];
  }
});

test('monitor keeps proactive greet actions enabled when online resume counter is above 200', async () => {
  const harness = setupMonitorHarness();
  harness.window.BHPPageApi.getStatus = async () => ({
    boss: { loggedIn: true, user: '张三 HR', newGreetingCount: 2 },
    dailyUsage: { follow_runs: 1, proactive_runs: 1, proactive_resume_views: 200 },
    automation: { running: false }
  });
  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousLocalStorage = global.localStorage;
  const previousRequestAnimationFrame = global.requestAnimationFrame;
  const modulePath = require.resolve('../src/ui/monitor/monitor.js');
  delete require.cache[modulePath];
  global.window = harness.window;
  global.document = harness.document;
  global.localStorage = harness.window.localStorage;
  global.requestAnimationFrame = (callback) => callback();
  try {
    require(modulePath);
    harness.documentListeners.DOMContentLoaded();
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(harness.elements.get('btn-pro-followup').disabled, false);
    assert.equal(harness.elements.get('btn-pro-greet').disabled, false);
    assert.equal(harness.elements.get('btn-pro-smart').disabled, false);
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.localStorage = previousLocalStorage;
    global.requestAnimationFrame = previousRequestAnimationFrame;
    delete require.cache[modulePath];
  }
});

test('monitor shows VIP advanced filters only for VIP BOSS accounts', async () => {
  const harness = setupMonitorHarness();
  harness.window.BHPPageApi.getStatus = async () => ({
    boss: { loggedIn: true, user: '张三 HR', vip: true, newGreetingCount: 2 },
    dailyUsage: { follow_runs: 1, proactive_runs: 0, proactive_resume_views: 7 },
    automation: { running: false }
  });
  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousLocalStorage = global.localStorage;
  const previousRequestAnimationFrame = global.requestAnimationFrame;
  const modulePath = require.resolve('../src/ui/monitor/monitor.js');
  delete require.cache[modulePath];
  global.window = harness.window;
  global.document = harness.document;
  global.localStorage = harness.window.localStorage;
  global.requestAnimationFrame = (callback) => callback();
  try {
    require(modulePath);
    harness.documentListeners.DOMContentLoaded();
    await new Promise((resolve) => setImmediate(resolve));

    assert.notEqual(harness.elements.get('s-vip_filters_block').style.display, 'none');
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.localStorage = previousLocalStorage;
    global.requestAnimationFrame = previousRequestAnimationFrame;
    delete require.cache[modulePath];
  }
});

test('monitor action groups are mutually exclusive and sub action gives immediate feedback', async () => {
  const harness = setupMonitorHarness();
  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousLocalStorage = global.localStorage;
  const previousRequestAnimationFrame = global.requestAnimationFrame;
  const modulePath = require.resolve('../src/ui/monitor/monitor.js');
  delete require.cache[modulePath];
  global.window = harness.window;
  global.document = harness.document;
  global.localStorage = harness.window.localStorage;
  global.requestAnimationFrame = (callback) => callback();
  try {
    require(modulePath);
    harness.documentListeners.DOMContentLoaded();
    await new Promise((resolve) => setImmediate(resolve));

    harness.elements.get('btn-follow').onclick();
    assert.match(harness.elements.get('follow-options').className, /show/);
    assert.doesNotMatch(harness.elements.get('proactive-options').className, /show/);

    harness.elements.get('btn-proactive').onclick();
    assert.doesNotMatch(harness.elements.get('follow-options').className, /show/);
    assert.match(harness.elements.get('proactive-options').className, /show/);

    const startPromise = harness.elements.get('btn-pro-greet').onclick();
    assert.match(harness.elements.get('btn-pro-greet').className, /active/);
    assert.equal(harness.elements.get('run-mode-title').textContent, '启动中：给牛人打招呼');
    assert.match(harness.elements.get('log').children[0].innerHTML, /牛人筛选 · 给牛人打招呼启动中/);
    await startPromise;
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.localStorage = previousLocalStorage;
    global.requestAnimationFrame = previousRequestAnimationFrame;
    delete require.cache[modulePath];
  }
});

test('monitor blocks start actions until BYO AI is configured', async () => {
  const harness = setupMonitorHarness();
  let startCalls = 0;
  harness.window.BHPPageApi.getSettings = async () => ({});
  harness.window.BHPPageApi.startAuto = async () => {
    startCalls += 1;
    return 'started';
  };

  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousLocalStorage = global.localStorage;
  const previousRequestAnimationFrame = global.requestAnimationFrame;
  const modulePath = require.resolve('../src/ui/monitor/monitor.js');
  delete require.cache[modulePath];
  global.window = harness.window;
  global.document = harness.document;
  global.localStorage = harness.window.localStorage;
  global.requestAnimationFrame = (callback) => callback();
  try {
    require(modulePath);
    harness.documentListeners.DOMContentLoaded();
    await new Promise((resolve) => setImmediate(resolve));

    await harness.elements.get('btn-pro-greet').onclick();

    assert.equal(startCalls, 0);
    assert.equal(harness.elements.get('ai-template-modal').style.display, 'flex');
    assert.equal(harness.elements.get('ai-template-modal-title').textContent, '需要先配置自定义 AI');
    assert.match(harness.elements.get('ai-template-modal-body').textContent, /自定义 AI/);
    assert.match(harness.elements.get('log').children[0].innerHTML, /请先配置自定义 AI/);
    assert.doesNotMatch(harness.elements.get('btn-pro-greet').className, /active/);
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.localStorage = previousLocalStorage;
    global.requestAnimationFrame = previousRequestAnimationFrame;
    delete require.cache[modulePath];
  }
});

test('monitor prompts to configure BYO before AI template generation', async () => {
  const harness = setupMonitorHarness();
  harness.window.BHPPageApi.getSettings = async () => ({});
  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousLocalStorage = global.localStorage;
  const previousRequestAnimationFrame = global.requestAnimationFrame;
  const previousSetTimeout = global.setTimeout;
  const modulePath = require.resolve('../src/ui/monitor/monitor.js');
  delete require.cache[modulePath];
  global.window = harness.window;
  global.document = harness.document;
  global.localStorage = harness.window.localStorage;
  global.requestAnimationFrame = (callback) => callback();
  global.setTimeout = (callback) => {
    callback();
    return 0;
  };
  try {
    require(modulePath);
    harness.documentListeners.DOMContentLoaded();
    await new Promise((resolve) => setImmediate(resolve));

    await harness.elements.get('s-message-ai-generate').onclick();
    assert.equal(harness.elements.get('ai-template-modal').style.display, 'flex');
    assert.equal(harness.elements.get('ai-template-modal-title').textContent, '需要先配置自定义 AI');

    harness.elements.get('ai-template-primary').onclick();
    assert.equal(harness.elements.get('ai-template-modal').style.display, 'none');
    assert.equal(harness.elements.get('s-byo-section').scrolled, true);
    assert.equal(harness.elements.get('s-byo-url').focused, true);
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.localStorage = previousLocalStorage;
    global.requestAnimationFrame = previousRequestAnimationFrame;
    global.setTimeout = previousSetTimeout;
    delete require.cache[modulePath];
  }
});

test('monitor prompts to configure BYO when opening recruitment settings', async () => {
  const harness = setupMonitorHarness();
  harness.window.BHPPageApi.getSettings = async () => ({});
  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousLocalStorage = global.localStorage;
  const previousRequestAnimationFrame = global.requestAnimationFrame;
  const previousSetTimeout = global.setTimeout;
  const modulePath = require.resolve('../src/ui/monitor/monitor.js');
  delete require.cache[modulePath];
  global.window = harness.window;
  global.document = harness.document;
  global.localStorage = harness.window.localStorage;
  global.requestAnimationFrame = (callback) => callback();
  global.setTimeout = (callback) => {
    callback();
    return 0;
  };
  try {
    require(modulePath);
    harness.documentListeners.DOMContentLoaded();
    await new Promise((resolve) => setImmediate(resolve));

    assert.notEqual(harness.elements.get('ai-template-modal').style.display, 'flex');

    await harness.elements.get('btn-settings-hd').onclick();

    assert.equal(harness.elements.get('settings-overlay').style.display, 'flex');
    assert.equal(harness.elements.get('ai-template-modal').style.display, 'flex');
    assert.equal(harness.elements.get('ai-template-modal-title').textContent, '需要先配置自定义 AI');
    assert.match(harness.elements.get('ai-template-modal-body').textContent, /自定义 AI/);

    harness.elements.get('ai-template-primary').onclick();
    assert.equal(harness.elements.get('ai-template-modal').style.display, 'none');
    assert.equal(harness.elements.get('s-byo-section').scrolled, true);
    assert.equal(harness.elements.get('s-byo-url').focused, true);
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.localStorage = previousLocalStorage;
    global.requestAnimationFrame = previousRequestAnimationFrame;
    global.setTimeout = previousSetTimeout;
    delete require.cache[modulePath];
  }
});

test('monitor fills message templates from configured BYO generation result', async () => {
  const harness = setupMonitorHarness();
  harness.window.BHPPageApi.generateMessageTemplates = async () => ({
    text: JSON.stringify({
      greeting: '你好，想和你聊聊岗位机会。',
      thank: '感谢关注，祝你求职顺利。',
      contact: '方便加微信进一步沟通吗？',
      contact_no_wechat: '方便在这里继续沟通吗？',
      job_closed: '岗位目前已关闭，感谢理解。',
      proactive_followup: '刚才给你发了岗位信息，方便看看吗？'
    })
  });

  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousLocalStorage = global.localStorage;
  const previousRequestAnimationFrame = global.requestAnimationFrame;
  const modulePath = require.resolve('../src/ui/monitor/monitor.js');
  delete require.cache[modulePath];
  global.window = harness.window;
  global.document = harness.document;
  global.localStorage = harness.window.localStorage;
  global.requestAnimationFrame = (callback) => callback();
  try {
    require(modulePath);
    harness.documentListeners.DOMContentLoaded();
    await new Promise((resolve) => setImmediate(resolve));
    harness.elements.get('s-byo-url').value = 'https://api.example.com/v1';
    harness.elements.get('s-byo-key').value = 'sk-test';
    harness.elements.get('s-byo-model').value = 'gpt-test';

    await harness.elements.get('s-message-ai-generate').onclick();

    assert.equal(harness.elements.get('s-msg-greeting').value, '你好，想和你聊聊岗位机会。');
    assert.equal(harness.elements.get('s-msg-contact').value, '方便加微信进一步沟通吗？');
    assert.equal(harness.elements.get('s-pro-followup-msg').value, '刚才给你发了岗位信息，方便看看吗？');
    assert.equal(harness.elements.get('settings-toast').textContent, '已生成话术，请检查后保存');
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.localStorage = previousLocalStorage;
    global.requestAnimationFrame = previousRequestAnimationFrame;
    delete require.cache[modulePath];
  }
});

test('monitor settings save includes proactive page filters and contact grades', async () => {
  const harness = setupMonitorHarness();
  const savedSettings = [];
  const classGroups = new Map();
  const withValue = (className, value, checked = false, attrs = {}) => {
    const el = createElement();
    el.value = value;
    el.checked = checked;
    el.attributes = attrs;
    const list = classGroups.get(className) || [];
    list.push(el);
    classGroups.set(className, list);
    return el;
  };
  const idValues = {
    's-run-time-limit-minutes': '15',
    's-age-max': '30',
    's-schools': '',
    's-companies': '',
    's-pro-age-max': '30',
    's-pro-schools': '',
    's-pro-companies': '',
    's-pro-followup-msg': '',
    's-msg-greeting': '',
    's-msg-thank': '',
    's-msg-contact': '',
    's-msg-contact-no-wechat': '',
    's-msg-job-closed': '',
    's-rating-prompt': '',
    's-byo-url': '',
    's-byo-key': '',
    's-byo-model': '',
    's-byo-headers': '',
    's-pf-salary': '20-50K'
  };
  for (const [id, value] of Object.entries(idValues)) {
    const el = harness.elements.get(id) || createElement(id);
    el.value = value;
    harness.elements.set(id, el);
  }
  [
    's-school-enabled',
    's-company-enabled',
    's-pro-school-enabled',
    's-pro-company-enabled',
    's-thank-on-fail-enabled',
    's-invite-on-pass-enabled',
    's-reply-mode-reply',
    's-exchange-wechat-enabled',
    's-byo-skip-probe',
    's-auto-download-log',
    's-debug-enabled',
    'btn-save-settings',
    'settings-toast'
  ].forEach((id) => {
    if (!harness.elements.has(id)) harness.elements.set(id, createElement(id));
  });
  withValue('s-pf-edu-cb', '本科', true);
  withValue('s-pf-edu-cb', '博士', false);
  withValue('s-pf-intention-cb', '在职-考虑机会', true);
  withValue('s-pf-exp-cb', '3-5年', true);
  withValue('s-bhp-vipf-cb', '可拨打', true, { 'data-key': 'callPhone' });
  withValue('s-bhp-vipf-cb', '985', true, { 'data-key': 'school' });
  withValue('s-bhp-vipf-cb', '近14天没有', true, { 'data-key': 'recentNotView' });
  withValue('s-grade-cb', 'A', true);
  withValue('s-grade-cb', 'C', true);
  harness.document.querySelectorAll = (selector) => classGroups.get(selector.replace(/^\./, '')) || [];
  harness.window.BHPPageApi.saveSettings = async (settings) => {
    savedSettings.push(settings);
    return settings;
  };

  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousLocalStorage = global.localStorage;
  const previousRequestAnimationFrame = global.requestAnimationFrame;
  const modulePath = require.resolve('../src/ui/monitor/monitor.js');
  delete require.cache[modulePath];
  global.window = harness.window;
  global.document = harness.document;
  global.localStorage = harness.window.localStorage;
  global.requestAnimationFrame = (callback) => callback();
  try {
    require(modulePath);
    harness.documentListeners.DOMContentLoaded();
    await harness.elements.get('btn-save-settings').onclick();

    assert.deepEqual(savedSettings[0].contact_grades, ['A', 'C']);
    assert.deepEqual(savedSettings[0].proactive_screening.page_filters.edu, ['本科']);
    assert.deepEqual(savedSettings[0].proactive_screening.page_filters.intention, ['在职-考虑机会']);
    assert.equal(savedSettings[0].proactive_screening.page_filters.salary, '20-50K');
    assert.deepEqual(savedSettings[0].proactive_screening.page_filters.experience, ['3-5年']);
    assert.deepEqual(savedSettings[0].proactive_screening.page_filters.callPhone, ['可拨打']);
    assert.deepEqual(savedSettings[0].proactive_screening.vip_filters.school, ['985']);
    assert.deepEqual(savedSettings[0].proactive_screening.vip_filters.recentNotView, ['近14天没有']);
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.localStorage = previousLocalStorage;
    global.requestAnimationFrame = previousRequestAnimationFrame;
    delete require.cache[modulePath];
  }
});

test('monitor settings quick presets append values and run limit label follows range input', async () => {
  const harness = setupMonitorHarness();
  const classGroups = new Map();
  const withPreset = (attrs) => {
    const el = createElement();
    el.attributes = attrs;
    const list = classGroups.get('preset-btn') || [];
    list.push(el);
    classGroups.set('preset-btn', list);
    return el;
  };
  const school985 = withPreset({ 'data-preset': '985' });
  const companyGame = withPreset({ 'data-company': 'game' });
  const proSchoolSyl = withPreset({ 'data-pro-preset': 'syl' });
  const proCompanyBigtech = withPreset({ 'data-pro-company': 'bigtech' });
  harness.document.querySelectorAll = (selector) => classGroups.get(selector.replace(/^\./, '')) || [];

  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousLocalStorage = global.localStorage;
  const previousRequestAnimationFrame = global.requestAnimationFrame;
  const modulePath = require.resolve('../src/ui/monitor/monitor.js');
  delete require.cache[modulePath];
  global.window = harness.window;
  global.document = harness.document;
  global.localStorage = harness.window.localStorage;
  global.requestAnimationFrame = (callback) => callback();
  try {
    require(modulePath);
    harness.documentListeners.DOMContentLoaded();
    await new Promise((resolve) => setImmediate(resolve));

    harness.elements.get('s-schools').value = '清华大学\n985';
    harness.elements.get('s-companies').value = '';
    harness.elements.get('s-pro-schools').value = '';
    harness.elements.get('s-pro-companies').value = '腾讯';
    harness.elements.get('s-run-time-limit-minutes').value = '15';

    assert.equal(typeof school985.onclick, 'function');
    assert.equal(typeof companyGame.onclick, 'function');
    assert.equal(typeof proSchoolSyl.onclick, 'function');
    assert.equal(typeof proCompanyBigtech.onclick, 'function');

    school985.onclick();
    companyGame.onclick();
    proSchoolSyl.onclick();
    proCompanyBigtech.onclick();

    const schools = harness.elements.get('s-schools').value.split('\n');
    assert.ok(schools.includes('北京大学'));
    assert.ok(schools.includes('国防科技大学'));
    assert.ok(schools.includes('985'));
    assert.equal(schools.filter((item) => item === '清华大学').length, 1);
    assert.match(harness.elements.get('s-companies').value, /腾讯/);
    assert.match(harness.elements.get('s-companies').value, /叠纸/);
    assert.match(harness.elements.get('s-companies').value, /4399/);
    assert.match(harness.elements.get('s-pro-schools').value, /上海科技大学/);
    assert.match(harness.elements.get('s-pro-schools').value, /南方科技大学/);
    assert.doesNotMatch(harness.elements.get('s-pro-schools').value, /^双一流$/);
    assert.match(harness.elements.get('s-pro-companies').value, /阿里巴巴/);
    assert.match(harness.elements.get('s-pro-companies').value, /华为/);
    assert.match(harness.elements.get('s-pro-companies').value, /Supercell/);
    assert.equal(harness.elements.get('s-pro-companies').value.split('\n').filter((item) => item === '腾讯').length, 1);

    harness.elements.get('s-run-time-limit-minutes').value = '11';
    harness.elements.get('s-run-time-limit-minutes').dispatchEvent({ type: 'input' });
    assert.equal(harness.elements.get('s-run-time-limit-minutes-value').textContent, '11 分钟');
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.localStorage = previousLocalStorage;
    global.requestAnimationFrame = previousRequestAnimationFrame;
    delete require.cache[modulePath];
  }
});

test('monitor settings toast auto hides and export downloads current settings', async () => {
  const harness = setupMonitorHarness();
  const created = [];
  const timers = [];
  harness.document.createElement = (tag) => {
    const el = createElement(tag);
    el.tagName = String(tag || '').toUpperCase();
    created.push(el);
    return el;
  };
  harness.window.BHPPageApi.saveSettings = async (settings) => settings;

  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousLocalStorage = global.localStorage;
  const previousRequestAnimationFrame = global.requestAnimationFrame;
  const previousSetTimeout = global.setTimeout;
  const previousClearTimeout = global.clearTimeout;
  const previousURL = global.URL;
  const previousBlob = global.Blob;
  const modulePath = require.resolve('../src/ui/monitor/monitor.js');
  delete require.cache[modulePath];
  global.window = harness.window;
  global.document = harness.document;
  global.localStorage = harness.window.localStorage;
  global.requestAnimationFrame = (callback) => callback();
  global.setTimeout = (callback, delay) => {
    const timer = { callback, delay };
    timers.push(timer);
    return timer;
  };
  global.clearTimeout = () => {};
  global.Blob = function Blob(parts, options) {
    this.parts = parts;
    this.options = options;
  };
  global.URL = {
    createObjectURL(blob) {
      this.lastBlob = blob;
      return 'blob:settings';
    },
    revokeObjectURL(url) {
      this.revoked = url;
    }
  };
  try {
    require(modulePath);
    harness.documentListeners.DOMContentLoaded();
    await new Promise((resolve) => setImmediate(resolve));

    await harness.elements.get('btn-save-settings').onclick();
    assert.equal(harness.elements.get('settings-toast').textContent, '已保存');
    assert.equal(timers.some((timer) => timer.delay >= 1500), true);
    timers[timers.length - 1].callback();
    assert.equal(harness.elements.get('settings-toast').textContent, '');

    harness.elements.get('settings-export-btn').onclick();
    const link = created.find((el) => el.tagName === 'A');
    assert.ok(link);
    assert.equal(link.href, 'blob:settings');
    assert.match(link.download, /recruiting-settings/);
    assert.equal(link.clicked, true);
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.localStorage = previousLocalStorage;
    global.requestAnimationFrame = previousRequestAnimationFrame;
    global.setTimeout = previousSetTimeout;
    global.clearTimeout = previousClearTimeout;
    global.URL = previousURL;
    global.Blob = previousBlob;
    delete require.cache[modulePath];
  }
});

test('monitor refreshes dynamic talent filter options from the current BOSS page', async () => {
  const harness = setupMonitorHarness();
  const calls = [];
  harness.window.BHPPageApi.byType = async (type, payload) => {
    calls.push([type, payload]);
    return {
      schema: {
        ts: '2026-06-10T08:00:00.000Z',
        groups: [
          { key: 'major', options: [{ text: '计算机科学' }, { text: '软件工程' }] },
          { key: 'keyword1', options: [{ text: 'React' }] }
        ]
      }
    };
  };

  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousLocalStorage = global.localStorage;
  const previousRequestAnimationFrame = global.requestAnimationFrame;
  const modulePath = require.resolve('../src/ui/monitor/monitor.js');
  delete require.cache[modulePath];
  global.window = harness.window;
  global.document = harness.document;
  global.localStorage = harness.window.localStorage;
  global.requestAnimationFrame = (callback) => callback();
  try {
    require(modulePath);
    harness.documentListeners.DOMContentLoaded();
    await new Promise((resolve) => setImmediate(resolve));

    await harness.elements.get('s-vip_filters_refresh').onclick();

    assert.deepEqual(calls[0], ['EXTRACT_VIP_FILTERS', {}]);
    assert.match(harness.elements.get('s-vip_filters_hint').textContent, /已采集 2 个筛选组/);
    assert.match(harness.elements.get('s-vip_major_options').innerHTML, /计算机科学/);
    assert.match(harness.elements.get('s-vip_keyword1_options').innerHTML, /React/);
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.localStorage = previousLocalStorage;
    global.requestAnimationFrame = previousRequestAnimationFrame;
    delete require.cache[modulePath];
  }
});

test('monitor loads and clears network logs from the side panel', async () => {
  const harness = setupMonitorHarness();
  const calls = [];
  harness.window.BHPPageApi.byType = async (type, payload) => {
    calls.push([type, payload]);
    if (type === 'GET_NET_LOG') {
      return [
        { ts: '08:00:01.100', method: 'GET', status: 200, duration: 32, url: 'https://www.zhipin.com/wapi/test' },
        { ts: '08:00:02.200', method: 'POST', status: 401, duration: 88, url: 'https://www.zhipin.com/wapi/logout', _logout: true }
      ];
    }
    return 'cleared';
  };

  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousLocalStorage = global.localStorage;
  const previousRequestAnimationFrame = global.requestAnimationFrame;
  const modulePath = require.resolve('../src/ui/monitor/monitor.js');
  delete require.cache[modulePath];
  global.window = harness.window;
  global.document = harness.document;
  global.localStorage = harness.window.localStorage;
  global.requestAnimationFrame = (callback) => callback();
  try {
    require(modulePath);
    harness.documentListeners.DOMContentLoaded();
    await new Promise((resolve) => setImmediate(resolve));

    await harness.elements.get('btn-netlog-load').onclick();

    assert.deepEqual(calls[0], ['GET_NET_LOG', {}]);
    assert.notEqual(harness.elements.get('netlog-list').style.display, 'none');
    assert.match(harness.elements.get('netlog-list').innerHTML, /POST/);
    assert.match(harness.elements.get('netlog-list').innerHTML, /401/);
    assert.match(harness.elements.get('netlog-info').textContent, /2 条/);

    await harness.elements.get('btn-netlog-clear').onclick();
    assert.deepEqual(calls[1], ['CLEAR_NET_LOG', {}]);
    assert.equal(harness.elements.get('netlog-list').style.display, 'none');
    assert.equal(harness.elements.get('netlog-list').innerHTML, '');
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.localStorage = previousLocalStorage;
    global.requestAnimationFrame = previousRequestAnimationFrame;
    delete require.cache[modulePath];
  }
});

test('monitor runs DOM sniffer and exposes useful presets', async () => {
  const harness = setupMonitorHarness();
  const calls = [];
  harness.elements.get('sniffer-root').value = '.vip-filters-wrap';
  harness.elements.get('sniffer-target').value = 'recommend';
  harness.elements.get('sniffer-depth').value = '8';
  harness.elements.get('sniffer-max-roots').value = '0';
  harness.elements.get('sniffer-strip').checked = true;
  harness.window.BHPPageApi.byType = async (type, payload) => {
    calls.push([type, payload]);
    return {
      results: [
        {
          frameId: 0,
          url: 'https://www.zhipin.com/web/geek/recommend',
          nodes: [{ selector: '.vip-filters-wrap', text: '专业 计算机科学' }]
        }
      ]
    };
  };

  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousLocalStorage = global.localStorage;
  const previousRequestAnimationFrame = global.requestAnimationFrame;
  const modulePath = require.resolve('../src/ui/monitor/monitor.js');
  delete require.cache[modulePath];
  global.window = harness.window;
  global.document = harness.document;
  global.localStorage = harness.window.localStorage;
  global.requestAnimationFrame = (callback) => callback();
  try {
    require(modulePath);
    harness.documentListeners.DOMContentLoaded();
    await new Promise((resolve) => setImmediate(resolve));

    harness.elements.get('sniffer-preset-cards').onclick();
    assert.equal(harness.elements.get('sniffer-root').value, '.candidate-card-wrap');
    assert.equal(harness.elements.get('sniffer-depth').value, '10');

    harness.elements.get('sniffer-preset-filters').onclick();
    assert.equal(harness.elements.get('sniffer-root').value, '.vip-filters-wrap, .filter-wrap');

    await harness.elements.get('sniffer-run').onclick();

    assert.equal(calls[0][0], 'SNIFF_DOM');
    assert.equal(calls[0][1].rootSelector, '.vip-filters-wrap, .filter-wrap');
    assert.match(harness.elements.get('sniffer-status').textContent, /完成/);
    assert.match(harness.elements.get('sniffer-output').value, /计算机科学/);

    harness.elements.get('sniffer-clear').onclick();
    assert.equal(harness.elements.get('sniffer-output').value, '');
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.localStorage = previousLocalStorage;
    global.requestAnimationFrame = previousRequestAnimationFrame;
    delete require.cache[modulePath];
  }
});

test('monitor shows diagnostics panels when debug mode is enabled', async () => {
  const harness = setupMonitorHarness();
  harness.window.BHPPageApi.getSettings = async () => ({ debug_enabled: true });

  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousLocalStorage = global.localStorage;
  const previousRequestAnimationFrame = global.requestAnimationFrame;
  const modulePath = require.resolve('../src/ui/monitor/monitor.js');
  delete require.cache[modulePath];
  global.window = harness.window;
  global.document = harness.document;
  global.localStorage = harness.window.localStorage;
  global.requestAnimationFrame = (callback) => callback();
  try {
    require(modulePath);
    harness.documentListeners.DOMContentLoaded();
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(harness.elements.get('s-debug-enabled').checked, true);
    assert.notEqual(harness.elements.get('debug-log-card').style.display, 'none');
    assert.notEqual(harness.elements.get('sniffer-card').style.display, 'none');
    assert.notEqual(harness.elements.get('netlog-section').style.display, 'none');

    harness.elements.get('s-debug-enabled').checked = false;
    harness.elements.get('s-debug-enabled').onchange({ target: harness.elements.get('s-debug-enabled') });
    assert.equal(harness.elements.get('debug-log-card').style.display, 'none');
    assert.equal(harness.elements.get('sniffer-card').style.display, 'none');
    assert.equal(harness.elements.get('netlog-section').style.display, 'none');
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.localStorage = previousLocalStorage;
    global.requestAnimationFrame = previousRequestAnimationFrame;
    delete require.cache[modulePath];
  }
});

test('monitor warns before saving a customized AI rating prompt', async () => {
  const harness = setupMonitorHarness();
  const savedSettings = [];
  harness.window.BHPPageApi.saveSettings = async (settings) => {
    savedSettings.push(settings);
    return settings;
  };

  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousLocalStorage = global.localStorage;
  const previousRequestAnimationFrame = global.requestAnimationFrame;
  const modulePath = require.resolve('../src/ui/monitor/monitor.js');
  delete require.cache[modulePath];
  global.window = harness.window;
  global.document = harness.document;
  global.localStorage = harness.window.localStorage;
  global.requestAnimationFrame = (callback) => callback();
  try {
    require(modulePath);
    harness.documentListeners.DOMContentLoaded();
    await new Promise((resolve) => setImmediate(resolve));

    harness.elements.get('s-rating-prompt').value = '请按我的规则评级候选人';
    await harness.elements.get('btn-save-settings').onclick();

    assert.equal(savedSettings.length, 0);
    assert.equal(harness.elements.get('ai-template-modal').style.display, 'flex');
    assert.equal(harness.elements.get('ai-template-modal-title').textContent, '确认修改评级 Prompt');
    assert.match(harness.elements.get('ai-template-modal-body').textContent, /JSON/);

    await harness.elements.get('ai-template-primary').onclick();
    assert.equal(savedSettings.length, 1);
    assert.equal(savedSettings[0].rating_prompt, '请按我的规则评级候选人');
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.localStorage = previousLocalStorage;
    global.requestAnimationFrame = previousRequestAnimationFrame;
    delete require.cache[modulePath];
  }
});

test('monitor loads saved page filters and contact grades into side-panel settings', async () => {
  const harness = setupMonitorHarness();
  const classGroups = new Map();
  const withValue = (className, value, attrs = {}) => {
    const el = createElement();
    el.value = value;
    el.attributes = attrs;
    const list = classGroups.get(className) || [];
    list.push(el);
    classGroups.set(className, list);
    return el;
  };
  const idDefaults = {
    's-run-time-limit-minutes': '',
    's-age-max': '',
    's-pro-age-max': '',
    's-pf-salary': '',
    's-msg-greeting': '',
    's-msg-thank': '',
    's-msg-contact': '',
    's-rating-prompt': '',
    's-byo-url': '',
    's-byo-model': ''
  };
  for (const [id, value] of Object.entries(idDefaults)) {
    const el = harness.elements.get(id) || createElement(id);
    el.value = value;
    harness.elements.set(id, el);
  }
  const edu = withValue('s-pf-edu-cb', '本科');
  const intention = withValue('s-pf-intention-cb', '在职-考虑机会');
  const exp = withValue('s-pf-exp-cb', '3-5年');
  const callPhone = withValue('s-bhp-vipf-cb', '可拨打', { 'data-key': 'callPhone' });
  const vipSchool = withValue('s-bhp-vipf-cb', '985', { 'data-key': 'school' });
  const gradeA = withValue('s-grade-cb', 'A');
  const gradeD = withValue('s-grade-cb', 'D');
  harness.document.querySelectorAll = (selector) => classGroups.get(selector.replace(/^\./, '')) || [];
  harness.window.BHPPageApi.getSettings = async () => ({
    run_time_limit_minutes: 12,
    age_max: 32,
    proactive_screening: {
      age_max: 29,
      page_filters: {
        edu: ['本科'],
        intention: ['在职-考虑机会'],
        salary: '20-50K',
        experience: ['3-5年'],
        callPhone: ['可拨打']
      },
      vip_filters: {
        school: ['985']
      }
    },
    contact_grades: ['A', 'D'],
    messages: {
      greeting: '你好',
      thank: '感谢',
      contact: '聊聊'
    },
    rating_prompt: '请评级',
    byo: {
      url: 'https://api.example.com/v1',
      model: 'gpt-test',
      advanced: {}
    }
  });

  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousLocalStorage = global.localStorage;
  const previousRequestAnimationFrame = global.requestAnimationFrame;
  const modulePath = require.resolve('../src/ui/monitor/monitor.js');
  delete require.cache[modulePath];
  global.window = harness.window;
  global.document = harness.document;
  global.localStorage = harness.window.localStorage;
  global.requestAnimationFrame = (callback) => callback();
  try {
    require(modulePath);
    harness.documentListeners.DOMContentLoaded();
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(harness.elements.get('s-run-time-limit-minutes').value, 12);
    assert.equal(harness.elements.get('s-age-max').value, 32);
    assert.equal(harness.elements.get('s-pro-age-max').value, 29);
    assert.equal(harness.elements.get('s-pf-salary').value, '20-50K');
    assert.equal(harness.elements.get('s-msg-greeting').value, '你好');
    assert.equal(harness.elements.get('s-rating-prompt').value, '请评级');
    assert.equal(harness.elements.get('s-byo-url').value, 'https://api.example.com/v1');
    assert.equal(edu.checked, true);
    assert.equal(intention.checked, true);
    assert.equal(exp.checked, true);
    assert.equal(callPhone.checked, true);
    assert.equal(vipSchool.checked, true);
    assert.equal(gradeA.checked, true);
    assert.equal(gradeD.checked, true);
  } finally {
    global.window = previousWindow;
    global.document = previousDocument;
    global.localStorage = previousLocalStorage;
    global.requestAnimationFrame = previousRequestAnimationFrame;
    delete require.cache[modulePath];
  }
});
