const test = require('node:test');
const assert = require('node:assert/strict');

const settings = require('../src/modules/settings.js');
const storage = require('../src/modules/storage.js');
const permissions = require('../src/modules/permissions.js');
const { createBackground } = require('../src/background/index.js');

function createFakeChrome() {
  const store = {};
  const listeners = {
    action: [],
    runtime: [],
    alarms: []
  };
  const permissionOrigins = new Set();

  return {
    _store: store,
    _listeners: listeners,
    _permissionOrigins: permissionOrigins,
    runtime: {
      lastError: null,
      onMessage: {
        addListener(fn) {
          listeners.runtime.push(fn);
        }
      },
      sendMessage() {}
    },
    action: {
      onClicked: {
        addListener(fn) {
          listeners.action.push(fn);
        }
      }
    },
    sidePanel: {
      async setPanelBehavior(options) {
        store.sidePanelBehavior = options;
      },
      async open(options) {
        store.sidePanelOpen = options;
      }
    },
    alarms: {
      create(name, info) {
        store[`alarm:${name}`] = info;
      },
      onAlarm: {
        addListener(fn) {
          listeners.alarms.push(fn);
        }
      }
    },
    storage: {
      local: {
        async get(keys) {
          if (!keys) return { ...store };
          if (typeof keys === 'string') return { [keys]: store[keys] };
          if (Array.isArray(keys)) {
            return Object.fromEntries(keys.map((key) => [key, store[key]]));
          }
          return Object.fromEntries(Object.keys(keys).map((key) => [key, store[key] ?? keys[key]]));
        },
        async set(values) {
          Object.assign(store, values);
        },
        async remove(keys) {
          for (const key of Array.isArray(keys) ? keys : [keys]) delete store[key];
        }
      }
    },
    permissions: {
      contains(query, callback) {
        callback(query.origins.every((origin) => permissionOrigins.has(origin)));
      },
      request(query, callback) {
        for (const origin of query.origins) permissionOrigins.add(origin);
        callback(true);
      },
      getAll(callback) {
        callback({ origins: Array.from(permissionOrigins) });
      }
    }
  };
}

test('background makes toolbar action open the side panel', async () => {
  const fakeChrome = createFakeChrome();
  const app = createBackground({
    chrome: fakeChrome,
    settings,
    storage,
    permissions,
    byoProvider: { testConnection: async () => ({ success: true, multimodal: false, detail: 'ok' }) }
  });

  app.register();
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(fakeChrome._store.sidePanelBehavior, { openPanelOnActionClick: true });
});

test('background handles settings, status and structured IPC errors', async () => {
  const fakeChrome = createFakeChrome();
  const app = createBackground({
    chrome: fakeChrome,
    settings,
    storage,
    permissions,
    byoProvider: { testConnection: async () => ({ success: true, multimodal: false, detail: 'ok' }) }
  });

  const saved = await app.handleCommand({
    type: 'SAVE_SETTINGS',
    payload: { settings: { run_time_limit_minutes: 99, contact_grades: ['A', 'C'] } }
  });
  assert.equal(saved.run_time_limit_minutes, 15);
  assert.deepEqual(saved.contact_grades, ['A', 'C']);

  const currentSettings = await app.handleCommand({ type: 'GET_SETTINGS' });
  assert.equal(currentSettings.run_time_limit_minutes, 15);

  const status = await app.handleCommand({ type: 'GET_STATUS' });
  assert.deepEqual(Object.keys(status).sort(), [
    'automation',
    'boss',
    'dailyUsage',
    'pause',
    'permissions',
    'settingsReady'
  ]);
  assert.equal(status.dailyUsage.proactive_resume_views, 0);
  assert.deepEqual(status.permissions.byoOrigins, []);
  assert.equal(status.pause.paused, false);

  const errorResponse = await app.dispatchMessage({ type: 'UNKNOWN_COMMAND' });
  assert.equal(errorResponse.ok, false);
  assert.equal(errorResponse.error.code, 'internal_error');
  assert.match(errorResponse.error.message, /Unknown message type/);
});

test('background requests BYO permission and records last permission status', async () => {
  const fakeChrome = createFakeChrome();
  const app = createBackground({
    chrome: fakeChrome,
    settings,
    storage,
    permissions,
    byoProvider: { testConnection: async () => ({ success: true, multimodal: true, detail: 'ok' }) }
  });

  const result = await app.handleCommand({
    type: 'REQUEST_BYO_PERMISSION',
    payload: { url: 'https://api.example.com/v1/chat/completions' }
  });
  assert.deepEqual(result, {
    granted: true,
    alreadyGranted: false,
    origin: 'https://api.example.com'
  });

  const status = await app.handleCommand({ type: 'GET_STATUS' });
  assert.deepEqual(status.permissions.byoOrigins, ['https://api.example.com']);
  assert.equal(status.permissions.lastByoPermission.origin, 'https://api.example.com');
  assert.equal(status.permissions.lastByoPermission.granted, true);

  const testResult = await app.handleCommand({
    type: 'BYO_TEST',
    payload: { url: 'https://api.example.com/v1', key: 'sk-test', model: 'gpt-4o-mini' }
  });
  assert.equal(testResult.success, true);
  assert.equal(testResult.multimodal, true);
});

test('background generates message templates through configured BYO only', async () => {
  const fakeChrome = createFakeChrome();
  const prompts = [];
  const app = createBackground({
    chrome: fakeChrome,
    settings,
    storage,
    permissions,
    byoProvider: {
      testConnection: async () => ({ success: true, multimodal: true, detail: 'ok' }),
      generateText: async (_config, prompt) => {
        prompts.push(prompt);
        return '{"greeting":"你好","thank":"感谢","contact":"加微信聊聊","contact_no_wechat":"站内聊聊","job_closed":"岗位已关闭","proactive_followup":"方便看看吗"}';
      }
    }
  });

  await app.handleCommand({
    type: 'REQUEST_BYO_PERMISSION',
    payload: { url: 'https://api.example.com/v1' }
  });

  const result = await app.handleCommand({
    type: 'BYO_GENERATE_TEMPLATES',
    payload: {
      settings: {
        byo: { url: 'https://api.example.com/v1', key: 'sk-test', model: 'gpt-test' },
        messages: { greeting: '旧招呼' }
      }
    }
  });

  assert.match(result.text, /greeting/);
  assert.match(prompts[0], /只输出 JSON/);
  assert.match(prompts[0], /旧招呼/);

  await assert.rejects(
    () => app.handleCommand({ type: 'BYO_GENERATE_TEMPLATES', payload: { settings: { byo: {} } } }),
    /请先配置自定义 AI/
  );
});

test('background delegates START_AUTO and STOP_AUTO to automation engine', async () => {
  const fakeChrome = createFakeChrome();
  const calls = [];
  const fakeAutomation = {
    ctx: {
      running: false,
      abort: false,
      mode: '',
      subMode: '',
      lastText: '',
      lastStats: '',
      startedAt: ''
    },
    async start(payload) {
      calls.push(['start', payload]);
      this.ctx.running = true;
      this.ctx.mode = payload.mode;
      this.ctx.subMode = payload.subMode;
      this.ctx.lastText = 'automation started';
      this.ctx.startedAt = '2026-06-10T00:00:00.000Z';
      return 'started';
    },
    async stop(reason) {
      calls.push(['stop', reason]);
      this.ctx.running = false;
      this.ctx.abort = true;
      this.ctx.lastText = 'automation stopped';
      return 'stopping';
    }
  };
  const app = createBackground({
    chrome: fakeChrome,
    settings,
    storage,
    permissions,
    automation: fakeAutomation,
    byoProvider: { testConnection: async () => ({ success: true, multimodal: false, detail: 'ok' }) }
  });

  assert.equal(await app.handleCommand({ type: 'START_AUTO', payload: { mode: 'proactive', subMode: 'greet' } }), 'started');
  assert.equal((await app.handleCommand({ type: 'GET_AUTO_STATUS' })).running, true);
  assert.equal(await app.handleCommand({ type: 'STOP_AUTO' }), 'stopping');
  assert.equal((await app.handleCommand({ type: 'GET_AUTO_STATUS' })).running, false);
  assert.deepEqual(calls, [
    ['start', { mode: 'proactive', subMode: 'greet' }],
    ['stop', 'user']
  ]);
});

test('background resume alarm restarts running list-level runState', async () => {
  const fakeChrome = createFakeChrome();
  fakeChrome._store.runState = {
    running: true,
    mode: 'follow',
    subMode: 'new',
    startedAt: '2026-06-10T00:00:00.000Z',
    checkpoint: { level: 'list', mode: 'follow', subMode: 'new', cursor: 1 },
    processedIds: ['c1']
  };
  const calls = [];
  const fakeAutomation = {
    ctx: {
      running: false,
      abort: false,
      mode: '',
      subMode: '',
      lastText: '',
      lastStats: '',
      startedAt: ''
    },
    async start(payload) {
      calls.push(payload);
      this.ctx.running = true;
      this.ctx.mode = payload.mode;
      this.ctx.subMode = payload.subMode;
      this.ctx.lastText = 'resumed';
      this.ctx.startedAt = fakeChrome._store.runState.startedAt;
      return 'started';
    }
  };
  const app = createBackground({
    chrome: fakeChrome,
    settings,
    storage,
    permissions,
    automation: fakeAutomation,
    byoProvider: { testConnection: async () => ({ success: true, multimodal: false, detail: 'ok' }) }
  });

  app.register();
  await fakeChrome._listeners.alarms[0]({ name: 'resumeTick' });

  assert.deepEqual(calls, [{ mode: 'follow', subMode: 'new', resume: true }]);
  assert.equal((await app.handleCommand({ type: 'GET_AUTO_STATUS' })).running, true);
});

test('background auto status resyncs after automation finishes asynchronously', async () => {
  const fakeChrome = createFakeChrome();
  const fakeAutomation = {
    ctx: {
      running: false,
      abort: false,
      mode: '',
      subMode: '',
      lastText: '',
      lastStats: '',
      startedAt: ''
    },
    async start(payload) {
      this.ctx.running = true;
      this.ctx.mode = payload.mode;
      this.ctx.subMode = payload.subMode;
      this.ctx.lastText = 'automation started';
      this.ctx.startedAt = '2026-06-10T00:00:00.000Z';
      return 'started';
    }
  };
  const app = createBackground({
    chrome: fakeChrome,
    settings,
    storage,
    permissions,
    automation: fakeAutomation,
    byoProvider: { testConnection: async () => ({ success: true, multimodal: false, detail: 'ok' }) }
  });

  await app.handleCommand({ type: 'START_AUTO', payload: { mode: 'follow', subMode: 'new' } });
  fakeAutomation.ctx.running = false;
  fakeAutomation.ctx.lastText = '处理完成';

  const status = await app.handleCommand({ type: 'GET_AUTO_STATUS' });

  assert.equal(status.running, false);
  assert.equal(status.lastText, '处理完成');
});

test('background GET_STATUS resumes running list-level runState before alarm fires', async () => {
  const fakeChrome = createFakeChrome();
  fakeChrome._store.runState = {
    running: true,
    mode: 'proactive',
    subMode: 'greet',
    startedAt: '2026-06-10T00:00:00.000Z',
    checkpoint: { level: 'list', mode: 'proactive', subMode: 'greet', cursor: 2 },
    processedIds: ['c1', 'c2']
  };
  const calls = [];
  const fakeAutomation = {
    ctx: {
      running: false,
      abort: false,
      mode: '',
      subMode: '',
      lastText: '',
      lastStats: '',
      startedAt: ''
    },
    async start(payload) {
      calls.push(payload);
      this.ctx.running = true;
      this.ctx.mode = payload.mode;
      this.ctx.subMode = payload.subMode;
      this.ctx.lastText = 'resumed from status';
      this.ctx.startedAt = fakeChrome._store.runState.startedAt;
      return 'started';
    }
  };
  const app = createBackground({
    chrome: fakeChrome,
    settings,
    storage,
    permissions,
    automation: fakeAutomation,
    byoProvider: { testConnection: async () => ({ success: true, multimodal: false, detail: 'ok' }) }
  });

  const status = await app.handleCommand({ type: 'GET_STATUS' });

  assert.deepEqual(calls, [{ mode: 'proactive', subMode: 'greet', resume: true }]);
  assert.equal(status.automation.running, true);
  assert.equal(status.automation.mode, 'proactive');
  assert.equal(status.automation.subMode, 'greet');
});

test('background delegates local page diagnostics without server dependencies', async () => {
  const fakeChrome = createFakeChrome();
  const calls = [];
  const fakeBrowserOps = {
    async extractVipFilters(payload) {
      calls.push(['extractVipFilters', payload]);
      return {
        groups: [
          { key: 'major', options: [{ text: '计算机科学' }] },
          { key: 'keyword1', options: [{ text: 'React' }] }
        ],
        ts: '2026-06-10T08:00:00.000Z'
      };
    },
    async sniffDom(payload) {
      calls.push(['sniffDom', payload]);
      return [{ frameId: 0, nodes: [{ selector: '.vip-filters-wrap' }] }];
    }
  };
  const app = createBackground({
    chrome: fakeChrome,
    settings,
    storage,
    permissions,
    browserOps: fakeBrowserOps,
    byoProvider: { testConnection: async () => ({ success: true, multimodal: false, detail: 'ok' }) }
  });

  const filterResult = await app.handleCommand({ type: 'EXTRACT_VIP_FILTERS', payload: {} });
  assert.equal(filterResult.schema.groups.length, 2);
  assert.deepEqual(fakeChrome._store.settings.proactive_screening.vip_dynamic_options.major, ['计算机科学']);
  assert.deepEqual(fakeChrome._store.settings.proactive_screening.vip_dynamic_options.keyword1, ['React']);

  const sniffResult = await app.handleCommand({
    type: 'SNIFF_DOM',
    payload: { rootSelector: '.vip-filters-wrap', maxDepth: 8 }
  });
  assert.deepEqual(sniffResult.results, [{ frameId: 0, nodes: [{ selector: '.vip-filters-wrap' }] }]);
  assert.deepEqual(calls, [
    ['extractVipFilters', {}],
    ['sniffDom', { rootSelector: '.vip-filters-wrap', maxDepth: 8 }]
  ]);
});

test('background exposes live BOSS status and pause controls without server dependencies', async () => {
  const fakeChrome = createFakeChrome();
  fakeChrome._store.autoPauseState = {
    ts: Date.now(),
    ttlMs: 15 * 60 * 1000,
    mode: 'follow',
    subMode: 'new',
    remainingMs: 6 * 60 * 1000
  };
  const calls = [];
  const fakeAutomation = {
    ctx: {
      running: false,
      abort: false,
      mode: '',
      subMode: '',
      lastText: '',
      lastStats: '',
      startedAt: ''
    },
    async resume() {
      calls.push('resume');
      this.ctx.running = true;
      this.ctx.mode = 'follow';
      this.ctx.subMode = 'new';
      return 'started';
    },
    snapshot() {
      return { running: this.ctx.running, mode: this.ctx.mode, subMode: this.ctx.subMode };
    }
  };
  const app = createBackground({
    chrome: fakeChrome,
    settings,
    storage,
    permissions,
    automation: fakeAutomation,
    browserOps: {
      async getBossStatus() {
        return {
          loggedIn: true,
          user: '张三 HR',
          vip: true,
          newGreetingCount: 3,
          tabCounts: { 新招呼: { count: 3, hasUnread: true } },
          lastCheckedAt: '2026-06-10T08:00:00.000Z'
        };
      },
      async getBossUserInfo() {
        return { username: '张三 HR', vip: true };
      },
      async getBossTabCounts() {
        return { 新招呼: { count: 3, hasUnread: true } };
      }
    },
    byoProvider: { testConnection: async () => ({ success: true, multimodal: false, detail: 'ok' }) }
  });

  const status = await app.handleCommand({ type: 'GET_STATUS' });
  assert.equal(status.boss.user, '张三 HR');
  assert.equal(status.boss.newGreetingCount, 3);
  assert.equal(status.pause.paused, true);
  assert.equal(status.pause.remainingMs, 6 * 60 * 1000);
  assert.equal(fakeChrome._store.bossStatus.user, '张三 HR');

  assert.deepEqual(await app.handleCommand({ type: 'GET_USER_INFO' }), { username: '张三 HR', vip: true });
  assert.deepEqual(await app.handleCommand({ type: 'GET_TAB_COUNTS' }), { 新招呼: { count: 3, hasUnread: true } });
  assert.equal(await app.handleCommand({ type: 'RESUME_AUTO' }), 'started');
  assert.deepEqual(calls, ['resume']);
  assert.equal((await app.handleCommand({ type: 'GET_AUTO_STATUS' })).running, true);

  await app.handleCommand({ type: 'CLEAR_PAUSE_STATE' });
  assert.equal(fakeChrome._store.autoPauseState, undefined);
});
