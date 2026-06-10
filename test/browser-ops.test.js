const test = require('node:test');
const assert = require('node:assert/strict');

const { createBrowserOps } = require('../src/modules/browser-ops.js');

function textNode(text) {
  return { textContent: text };
}

function createCardFixture({ id, text, name, jobTitle, school, company, hasGreetBtn = true }) {
  const schoolNode = {
    textContent: school,
    querySelector(selector) {
      return selector === 'span' ? textNode(school) : null;
    }
  };
  const companyNode = {
    textContent: company,
    querySelector(selector) {
      return selector === 'span' ? textNode(company) : null;
    }
  };
  return {
    textContent: text,
    dataset: {},
    getAttribute(attr) {
      const attrs = {
        'data-geek-id': id,
        'data-geekid': id,
        'data-id': id
      };
      return attrs[attr] || null;
    },
    querySelector(selector) {
      if (selector === '.card-inner') return { dataset: { geek: id, geekid: id } };
      if (selector === '.btn-greet') return hasGreetBtn ? textNode('打招呼') : null;
      if (selector === '.base-info') return textNode(text);
      if (selector === '.name') return textNode(name);
      if (/name|geek/i.test(selector)) return textNode(name);
      if (/job|position|expect/i.test(selector)) return textNode(jobTitle);
      if (/school|edu|education/i.test(selector)) return textNode(school);
      if (/company|work/i.test(selector)) return textNode(company);
      return null;
    },
    querySelectorAll(selector) {
      if (/edu-exps/.test(selector)) return [schoolNode];
      if (/work-exps/.test(selector)) return [companyNode];
      return [];
    }
  };
}

function createClickOption(text, clicks) {
  return {
    textContent: text,
    getAttribute() { return null; },
    closest() { return null; },
    classList: { contains() { return false; } },
    click() { clicks.push(text); },
    dispatchEvent() { return true; },
    scrollIntoView() {}
  };
}

function createScriptableChrome(documentFactory, calls = []) {
  return {
    runtime: { lastError: null },
    tabs: {
      query(query, callback) {
        calls.push(['query', query.url]);
        callback([{ id: 7, url: 'https://www.zhipin.com/web/geek/recommend' }]);
      },
      create(props, callback) {
        calls.push(['create', props.url]);
        callback({ id: 9, url: props.url });
      }
    },
    scripting: {
      executeScript(details, callback) {
        calls.push(['executeScript', details.world, details.target.tabId]);
        const previousDocument = global.document;
        const previousWindow = global.window;
        global.document = documentFactory(details);
        global.window = {
          Event: global.Event,
          InputEvent: global.InputEvent,
          MouseEvent: global.MouseEvent
        };
        try {
          const result = details.func(...(details.args || []));
          callback([{ result }]);
        } finally {
          global.document = previousDocument;
          global.window = previousWindow;
        }
      }
    }
  };
}

test('browser ops reuses existing zhipin tab before creating a new one', async () => {
  const calls = [];
  const fakeChrome = {
    tabs: {
      query(query, callback) {
        calls.push(['query', query.url]);
        callback([{ id: 7, url: 'https://www.zhipin.com/web/geek/recommend' }]);
      },
      create(props, callback) {
        calls.push(['create', props.url]);
        callback({ id: 9, url: props.url });
      }
    },
    runtime: { lastError: null }
  };

  const ops = createBrowserOps({ chrome: fakeChrome });
  assert.deepEqual(await ops.getOrOpenBossTab(), { id: 7, url: 'https://www.zhipin.com/web/geek/recommend' });
  assert.deepEqual(calls, [['query', ['https://*.zhipin.com/*', 'https://zhipin.com/*']]]);
});

test('safeTabsUpdate retries transient Chrome tab edit errors', async () => {
  let attempts = 0;
  const fakeChrome = {
    runtime: { lastError: null },
    tabs: {
      update(tabId, props, callback) {
        attempts += 1;
        if (attempts < 3) {
          fakeChrome.runtime.lastError = { message: 'Tabs cannot be edited right now' };
          callback();
          fakeChrome.runtime.lastError = null;
          return;
        }
        callback({ id: tabId, url: props.url });
      }
    }
  };

  const ops = createBrowserOps({ chrome: fakeChrome, delay: async () => {} });
  assert.deepEqual(await ops.safeTabsUpdate(7, { url: 'https://www.zhipin.com/' }, 5), {
    id: 7,
    url: 'https://www.zhipin.com/'
  });
  assert.equal(attempts, 3);
});

test('scanCandidates injects into MAIN world and extracts proactive recommendation cards', async () => {
  const cards = [
    createCardFixture({
      id: 'geek-1',
      name: '王晓雨',
      jobTitle: '前端工程师',
      school: '浙江大学',
      company: '腾讯',
      text: '王晓雨 前端工程师 26岁 浙江大学 腾讯 在线简历'
    }),
    createCardFixture({
      id: 'geek-2',
      name: '李明',
      jobTitle: '后端工程师',
      school: '普通本科',
      company: '创业公司',
      text: '李明 后端工程师 31岁 普通本科 创业公司 暂无在线简历'
    })
  ];
  const calls = [];
  const fakeChrome = createScriptableChrome(() => ({
    querySelectorAll(selector) {
      return /candidate|geek|card/i.test(selector) ? cards : [];
    }
  }), calls);

  const ops = createBrowserOps({ chrome: fakeChrome });
  const result = await ops.scanCandidates({ mode: 'proactive' });

  assert.equal(result.length, 2);
  assert.equal(result[0].id, 'geek-1');
  assert.equal(result[0].candidate_name, '王晓雨');
  assert.equal(result[0].school, '浙江大学');
  assert.deepEqual(result[0].schools, ['浙江大学']);
  assert.equal(result[0].company, '腾讯');
  assert.equal(result[0].age, 26);
  assert.equal(result[0].hasGreetBtn, true);
  assert.equal(result[1].id, 'geek-2');
  assert.deepEqual(calls.at(-1), ['executeScript', 'MAIN', 7]);
});

test('scanCandidates applies proactive page filters before scanning recommendations', async () => {
  const clicks = [];
  const filterOptions = [
    '本科',
    '在职-考虑机会',
    '20-50K',
    '3-5年',
    '可拨打',
    '985',
    '今日活跃'
  ].map((text) => createClickOption(text, clicks));
  const cards = [
    createCardFixture({
      id: 'geek-1',
      name: '王晓雨',
      jobTitle: '前端工程师',
      school: '浙江大学',
      company: '腾讯',
      text: '王晓雨 前端工程师 26岁 浙江大学 腾讯 在线简历'
    })
  ];
  const fakeChrome = createScriptableChrome(() => ({
    querySelectorAll(selector) {
      if (/candidate|geek|card/i.test(selector)) return cards;
      if (/button|label|li|span|a|div|\[role/.test(selector)) return filterOptions;
      return [];
    }
  }));

  const ops = createBrowserOps({ chrome: fakeChrome });
  const result = await ops.scanCandidates({
    mode: 'proactive',
    subMode: 'greet',
    settings: {
      proactive_screening: {
        page_filters: {
          edu: ['本科'],
          intention: ['在职-考虑机会'],
          salary: '20-50K',
          experience: ['3-5年'],
          callPhone: ['可拨打']
        },
        vip_filters: {
          school: ['985'],
          activation: '今日活跃'
        }
      }
    }
  });

  assert.deepEqual(clicks, ['本科', '在职-考虑机会', '20-50K', '3-5年', '可拨打', '985', '今日活跃']);
  assert.equal(result.length, 1);
});

test('scanCandidates switches follow mode to chat sessions and returns unread candidates', async () => {
  const calls = [];
  const sessions = [
    {
      querySelector(selector) {
        if (selector === '.geek-name') return textNode('王晓雨');
        if (selector === '.source-job') return textNode('前端工程师');
        if (selector === '.unread-tips, .badge-count') {
          return { offsetWidth: 8, offsetHeight: 8, getClientRects: () => [1] };
        }
        if (selector === '.push-text') return textNode('我对岗位有兴趣');
        return null;
      },
      getAttribute(attr) {
        return attr === 'data-id' ? 'session-1' : null;
      },
      id: '',
      classList: { contains: () => false }
    },
    {
      querySelector(selector) {
        if (selector === '.geek-name') return textNode('李明');
        if (selector === '.source-job') return textNode('后端工程师');
        if (selector === '.push-text') return textNode('已读消息');
        return null;
      },
      getAttribute(attr) {
        return attr === 'data-id' ? 'session-2' : null;
      },
      id: '',
      classList: { contains: () => false }
    }
  ];
  const fakeChrome = {
    runtime: { lastError: null },
    tabs: {
      query(query, callback) {
        calls.push(['query', query.url]);
        callback([{ id: 7, url: 'https://www.zhipin.com/web/geek/recommend' }]);
      },
      update(tabId, props, callback) {
        calls.push(['update', tabId, props.url]);
        callback({ id: tabId, url: props.url });
      }
    },
    scripting: {
      executeScript(details, callback) {
        calls.push(['executeScript', details.world, details.target.tabId]);
        const previousDocument = global.document;
        global.document = {
          querySelectorAll(selector) {
            return selector === '.geek-item-wrap' ? sessions : [];
          }
        };
        try {
          callback([{ result: details.func(...(details.args || [])) }]);
        } finally {
          global.document = previousDocument;
        }
      }
    }
  };
  const ops = createBrowserOps({ chrome: fakeChrome, delay: async () => {} });

  const result = await ops.scanCandidates({ mode: 'follow', subMode: 'new' });

  assert.deepEqual(calls.slice(0, 2), [
    ['query', ['https://*.zhipin.com/*', 'https://zhipin.com/*']],
    ['update', 7, 'https://www.zhipin.com/web/chat/index']
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'session-1');
  assert.equal(result[0].candidate_name, '王晓雨');
  assert.equal(result[0].source, 'session');
  assert.equal(result[0].hasUnread, true);
});

test('captureResume returns visible resume text merged with candidate metadata', async () => {
  const fakeChrome = createScriptableChrome(() => ({
    body: textNode('页面兜底文本'),
    querySelector(selector) {
      if (/resume|geek-info|dialog/i.test(selector)) {
        return textNode('王晓雨 在线简历 项目经历 React 组件库 浙江大学');
      }
      return null;
    }
  }));
  const ops = createBrowserOps({ chrome: fakeChrome });

  const result = await ops.captureResume({ id: 'geek-1', candidate_name: '王晓雨', resumeText: '卡片文本' });

  assert.equal(result.id, 'geek-1');
  assert.equal(result.candidate_name, '王晓雨');
  assert.match(result.resumeText, /项目经历 React/);
  assert.equal(result.source, 'dom');
});

test('sendCandidateMessage writes to editor and clicks the send button', async () => {
  let editorText = '';
  let clicked = false;
  const editor = {
    textContent: '',
    innerText: '',
    value: '',
    isContentEditable: true,
    focus() {},
    dispatchEvent() { return true; }
  };
  const sendButton = {
    textContent: '发送',
    click() { clicked = true; },
    dispatchEvent() { return true; }
  };
  const fakeChrome = createScriptableChrome(() => ({
    querySelector(selector) {
      if (/contenteditable|textarea|editor|input/i.test(selector)) return editor;
      if (/send|btn/i.test(selector)) return sendButton;
      return null;
    },
    querySelectorAll(selector) {
      if (/button|send|btn/i.test(selector)) return [sendButton];
      return [];
    }
  }));
  const ops = createBrowserOps({ chrome: fakeChrome });

  const result = await ops.sendCandidateMessage({ id: 'geek-1' }, { action: 'contact', message: '你好，方便聊聊吗？' });
  editorText = editor.textContent || editor.innerText || editor.value;

  assert.deepEqual(result, { sent: true, action: 'contact' });
  assert.equal(editorText, '你好，方便聊聊吗？');
  assert.equal(clicked, true);
});

test('greetRecommendCandidate clicks the matched recommendation card greet button', async () => {
  let clicked = false;
  const card = {
    textContent: '王晓雨 26岁 浙江大学 腾讯',
    querySelector(selector) {
      if (selector === '.card-inner') return { dataset: { geek: 'geek-1', geekid: 'geek-1' } };
      if (selector === '.btn-greet') {
        return {
          textContent: '打招呼',
          click() { clicked = true; },
          dispatchEvent() { return true; },
          scrollIntoView() {}
        };
      }
      return null;
    },
    scrollIntoView() {}
  };
  const fakeChrome = createScriptableChrome(() => ({
    querySelectorAll(selector) {
      return selector === '.candidate-card-wrap' ? [card] : [];
    }
  }));
  const ops = createBrowserOps({ chrome: fakeChrome });

  const result = await ops.greetRecommendCandidate({ geekId: 'geek-1' }, { message: '你好' });

  assert.equal(result.sent, true);
  assert.equal(result.result, 'ok');
  assert.equal(clicked, true);
});

test('extractVipFilters collects dynamic major and talent keyword options', async () => {
  const optionNodes = {
    major: [
      { textContent: '计算机科学', getAttribute: () => null },
      { textContent: '软件工程', getAttribute: () => null }
    ],
    keyword: [
      { textContent: 'React', getAttribute: () => null },
      { textContent: 'Node.js', getAttribute: () => null }
    ]
  };
  const fakeChrome = createScriptableChrome(() => ({
    querySelectorAll(selector) {
      if (/major/i.test(selector)) return optionNodes.major;
      if (/keyword|tag/i.test(selector)) return optionNodes.keyword;
      return [];
    }
  }));
  const ops = createBrowserOps({ chrome: fakeChrome });

  const schema = await ops.extractVipFilters();

  assert.deepEqual(schema.groups.map((group) => group.key), ['major', 'keyword1']);
  assert.deepEqual(schema.groups[0].options.map((item) => item.text), ['计算机科学', '软件工程']);
  assert.deepEqual(schema.groups[1].options.map((item) => item.text), ['React', 'Node.js']);
  assert.ok(schema.ts);
});

test('extractVipFilters navigates existing chat tab to recommendation page before collecting options', async () => {
  const calls = [];
  const fakeChrome = {
    runtime: { lastError: null },
    tabs: {
      query(query, callback) {
        calls.push(['query', query.url]);
        callback([{ id: 7, url: 'https://www.zhipin.com/web/chat/index' }]);
      },
      update(tabId, props, callback) {
        calls.push(['update', tabId, props.url]);
        callback({ id: tabId, url: props.url });
      }
    },
    scripting: {
      executeScript(details, callback) {
        calls.push(['executeScript', details.target.tabId]);
        const previousDocument = global.document;
        global.document = {
          querySelectorAll(selector) {
            if (/major/i.test(selector)) return [{ textContent: '计算机科学', getAttribute: () => null }];
            if (/keyword|tag/i.test(selector)) return [{ textContent: 'React', getAttribute: () => null }];
            return [];
          }
        };
        try {
          callback([{ result: details.func(...(details.args || [])) }]);
        } finally {
          global.document = previousDocument;
        }
      }
    }
  };
  const ops = createBrowserOps({ chrome: fakeChrome, delay: async () => {} });

  const schema = await ops.extractVipFilters();

  assert.deepEqual(calls.slice(0, 2), [
    ['query', ['https://*.zhipin.com/*', 'https://zhipin.com/*']],
    ['update', 7, 'https://www.zhipin.com/web/geek/recommend']
  ]);
  assert.deepEqual(schema.groups[0].options.map((item) => item.text), ['计算机科学']);
  assert.deepEqual(schema.groups[1].options.map((item) => item.text), ['React']);
});

test('sniffDom serializes matching roots from the active BOSS tab', async () => {
  const rootNode = {
    tagName: 'DIV',
    id: 'filters',
    className: 'vip-filters-wrap',
    textContent: '专业 计算机科学',
    children: [
      {
        tagName: 'SPAN',
        id: '',
        className: 'filter-option',
        textContent: '计算机科学',
        children: [],
        getAttribute() { return null; }
      }
    ],
    getAttribute(attr) {
      if (attr === 'role') return 'group';
      return null;
    }
  };
  const fakeChrome = createScriptableChrome(() => ({
    location: { href: 'https://www.zhipin.com/web/geek/recommend' },
    querySelectorAll(selector) {
      return selector === '.vip-filters-wrap' ? [rootNode] : [];
    }
  }));
  const ops = createBrowserOps({ chrome: fakeChrome });

  const results = await ops.sniffDom({ rootSelector: '.vip-filters-wrap', maxDepth: 2, stripEmpty: true });

  assert.equal(results.length, 1);
  assert.equal(results[0].nodes[0].selector, 'div#filters.vip-filters-wrap');
  assert.match(results[0].nodes[0].text, /专业/);
  assert.equal(results[0].nodes[0].children[0].selector, 'span.filter-option');
});

test('getBossStatus reads account info and new greeting count from BOSS tabs', async () => {
  const fakeChrome = {
    runtime: { lastError: null },
    tabs: {
      query(query, callback) {
        assert.deepEqual(query.url, ['https://*.zhipin.com/*', 'https://zhipin.com/*']);
        callback([
          { id: 7, url: 'https://www.zhipin.com/web/user/' },
          { id: 8, url: 'https://www.zhipin.com/web/chat/index' }
        ]);
      }
    },
    scripting: {
      executeScript(details, callback) {
        const previousDocument = global.document;
        if (details.target.tabId === 7) {
          global.document = {
            querySelector(selector) {
              if (selector.includes('header-username')) return { textContent: '张三 HR' };
              if (selector.includes('icon-vip')) return { textContent: '' };
              return null;
            },
            querySelectorAll() { return []; }
          };
        } else {
          const items = [
            {
              getAttribute: () => '新招呼(3)',
              querySelector: () => ({})
            },
            {
              getAttribute: () => '沟通中(1)',
              querySelector: () => null
            }
          ];
          global.document = {
            querySelectorAll(selector) {
              return selector === '.chat-label-item' ? items : [];
            }
          };
        }
        try {
          callback([{ result: details.func(...(details.args || [])) }]);
        } finally {
          global.document = previousDocument;
        }
      }
    }
  };
  const ops = createBrowserOps({ chrome: fakeChrome });

  const status = await ops.getBossStatus();

  assert.equal(status.loggedIn, true);
  assert.equal(status.user, '张三 HR');
  assert.equal(status.vip, true);
  assert.equal(status.newGreetingCount, 3);
  assert.deepEqual(status.tabCounts['沟通中'], { count: 1, hasUnread: true });
});
