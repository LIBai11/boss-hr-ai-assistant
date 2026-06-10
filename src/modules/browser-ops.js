(function initBrowserOpsModule(root) {
  'use strict';

  const BOSS_URLS = ['https://*.zhipin.com/*', 'https://zhipin.com/*'];
  const DEFAULT_BOSS_URL = 'https://www.zhipin.com/web/geek/recommend';
  const DEFAULT_CHAT_URL = 'https://www.zhipin.com/web/chat/index';
  const PAGE_HELPERS_SOURCE = `
function normalizeText(text) {
  return String(text || '').replace(/\\s+/g, ' ').trim();
}
function firstText(root, selectors) {
  for (const selector of selectors) {
    const el = root && root.querySelector ? root.querySelector(selector) : null;
    const text = normalizeText((el && (el.textContent || el.innerText || el.value)) || '');
    if (text) return text;
  }
  return '';
}
function firstAttr(root, attrs) {
  for (const attr of attrs) {
    const value = root && root.getAttribute ? root.getAttribute(attr) : '';
    if (value) return String(value);
  }
  return '';
}
function extractAge(text) {
  const match = normalizeText(text).match(/(?:^|[^\\d])([1-6]\\d)\\s*岁/);
  return match ? Number(match[1]) : undefined;
}
function isOnlineResumeText(text) {
  const value = normalizeText(text);
  return /在线简历/.test(value) && !/(暂无|没有|无|未开放)\\s*在线简历/.test(value);
}
function uniqueList(items) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const value = normalizeText(item);
    if (!value || value === '不限' || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}
function queryAllSafe(selector) {
  try {
    return Array.from(document.querySelectorAll(selector) || []);
  } catch (error) {
    return [];
  }
}
function textOfClickable(node) {
  const attrs = ['title', 'aria-label', 'data-value', 'value'];
  const attrText = attrs.map((attr) => node && node.getAttribute ? node.getAttribute(attr) : '').find(Boolean);
  return normalizeText(attrText || (node && (node.textContent || node.innerText || node.value)) || '');
}
function collectOptionTexts(selectors) {
  const values = [];
  for (const selector of selectors) {
    for (const node of queryAllSafe(selector)) values.push(textOfClickable(node));
  }
  return uniqueList(values).slice(0, 80).map((text) => ({ text }));
}
function classTokens(value) {
  if (!value) return [];
  if (typeof value === 'string') return value.split(/\\s+/).filter(Boolean).slice(0, 4);
  if (value.baseVal) return String(value.baseVal).split(/\\s+/).filter(Boolean).slice(0, 4);
  return [];
}
function safeIdentifier(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '\\\\$&');
}
function nodeSelector(node) {
  const tag = String((node && node.tagName) || 'node').toLowerCase();
  const id = node && node.id ? '#' + safeIdentifier(node.id) : '';
  const classes = classTokens(node && node.className).map((name) => '.' + safeIdentifier(name)).join('');
  return tag + id + classes;
}
function serializeNode(node, depth, options = {}) {
  const text = normalizeText((node && node.textContent) || '').slice(0, 500);
  const children = depth > 0
    ? Array.from((node && node.children) || []).map((child) => serializeNode(child, depth - 1, options)).filter(Boolean)
    : [];
  if (options.stripEmpty && !text && children.length === 0) return null;
  const out = { selector: nodeSelector(node) };
  if (text) out.text = text;
  const role = node && node.getAttribute ? node.getAttribute('role') : '';
  const title = node && node.getAttribute ? node.getAttribute('title') : '';
  const aria = node && node.getAttribute ? node.getAttribute('aria-label') : '';
  if (role || title || aria) {
    out.attrs = {};
    if (role) out.attrs.role = role;
    if (title) out.attrs.title = title;
    if (aria) out.attrs.ariaLabel = aria;
  }
  if (children.length) out.children = children;
  return out;
}
function filterValuesFromScreening(screening = {}) {
  const pageFilters = screening.page_filters || {};
  const vipFilters = screening.vip_filters || {};
  const values = [];
  values.push(...uniqueList(pageFilters.edu));
  values.push(...uniqueList(pageFilters.intention));
  values.push(...uniqueList([pageFilters.salary]));
  values.push(...uniqueList(pageFilters.experience));
  values.push(...uniqueList(pageFilters.callPhone));
  for (const value of Object.values(vipFilters)) {
    if (Array.isArray(value)) values.push(...uniqueList(value));
    else values.push(...uniqueList([value]));
  }
  return uniqueList(values);
}
function candidateClickTargets() {
  const selector = [
    'button',
    'label',
    'li',
    'span',
    'a',
    '[role="button"]',
    '[role="option"]',
    '[class*="filter"]',
    '[class*="select"]',
    '[class*="option"]'
  ].join(',');
  return Array.from(document.querySelectorAll(selector) || [])
    .filter(Boolean)
    .sort((left, right) => normalizeText(left.textContent).length - normalizeText(right.textContent).length);
}
function findFilterOption(value) {
  const target = normalizeText(value);
  if (!target) return null;
  return candidateClickTargets().find((node) => {
    const text = textOfClickable(node);
    if (!text) return false;
    if (text === target) return true;
    return text.includes(target) && text.length <= target.length + 12;
  }) || null;
}
function createEvent(name, options = {}) {
  try {
    if (name === 'input' && typeof InputEvent === 'function') return new InputEvent(name, options);
  } catch (_) {}
  try {
    return new Event(name, options);
  } catch (_) {
    return { type: name, ...options };
  }
}
function clickPageElement(element) {
  element.scrollIntoView && element.scrollIntoView({ block: 'center', inline: 'nearest' });
  element.dispatchEvent && element.dispatchEvent(createEvent('mousedown', { bubbles: true, cancelable: true }));
  element.dispatchEvent && element.dispatchEvent(createEvent('mouseup', { bubbles: true, cancelable: true }));
  element.click && element.click();
  element.dispatchEvent && element.dispatchEvent(createEvent('click', { bubbles: true, cancelable: true }));
}
function extractYears(node) {
  const text = normalizeText((node && node.textContent) || '').replace(/^\\d+岁/, '');
  if (!text) return { years: -2, label: '' };
  const special = ['在校/应届', '25年毕业', '26年毕业', '26年后毕业'];
  for (const label of special) {
    if (text.startsWith(label)) return { years: -1, label };
  }
  if (text.startsWith('1年以内') || text.startsWith('1年内')) return { years: 0, label: '1年以内' };
  if (text.startsWith('10年以上')) return { years: 10, label: '10年以上' };
  const yearMatch = text.match(/^(\\d+)年/);
  if (yearMatch) return { years: Number(yearMatch[1]), label: yearMatch[0] };
  const monthMatch = text.match(/^(\\d+)个月/);
  if (monthMatch) return { years: 0, label: monthMatch[0] };
  return { years: -2, label: '' };
}
function findSendButton() {
  const directSelectors = [
    '.submit.active',
    'div.submit.active',
    '.btn-send',
    '.send-btn',
    '.boss-chat-send',
    '[class*="send"]',
    'button[type="submit"]'
  ];
  for (const selector of directSelectors) {
    const button = document.querySelector(selector);
    if (button) return button;
  }
  const buttons = Array.from(document.querySelectorAll('button, [role="button"], .btn') || []);
  return buttons.find((button) => /发送|打招呼|回复|send/i.test(normalizeText(button.textContent))) || null;
}
function setEditorText(editor, message) {
  editor.focus && editor.focus();
  const editable = editor.isContentEditable || (editor.getAttribute && editor.getAttribute('contenteditable') === 'true');
  if (editable) {
    editor.textContent = message;
    editor.innerText = message;
  } else {
    editor.value = message;
  }
  editor.dispatchEvent && editor.dispatchEvent(createEvent('input', { bubbles: true, data: message, inputType: 'insertText' }));
  editor.dispatchEvent && editor.dispatchEvent(createEvent('change', { bubbles: true }));
}
`;

  function createBrowserOps(options = {}) {
    const chromeLike = options.chrome || root.chrome;
    const delay = options.delay || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

    function callbackCall(fn, ...args) {
      return new Promise((resolve, reject) => {
        if (typeof fn !== 'function') {
          reject(new Error('Chrome API unavailable'));
          return;
        }
        let settled = false;
        function settleWith(value) {
          if (settled) return;
          settled = true;
          const runtimeError = chromeLike?.runtime?.lastError;
          if (runtimeError) reject(new Error(runtimeError.message || String(runtimeError)));
          else resolve(value);
        }
        function settleError(error) {
          if (settled) return;
          settled = true;
          reject(error);
        }
        try {
          const result = fn(...args, settleWith);
          if (result && typeof result.then === 'function') result.then(settleWith, settleError);
        } catch (error) {
          settleError(error);
        }
      });
    }

    async function safeTabsUpdate(tabId, updateProps, maxRetries = 5) {
      let lastError = null;
      for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
        try {
          return await callbackCall(chromeLike?.tabs?.update?.bind(chromeLike.tabs), tabId, updateProps);
        } catch (error) {
          lastError = error;
          if (!/cannot be edited|drag|user may be dragging/i.test(error.message || '') || attempt === maxRetries) {
            throw error;
          }
          await delay(120 * attempt);
        }
      }
      throw lastError;
    }

    async function getOrOpenBossTab(url = DEFAULT_BOSS_URL) {
      const tabs = await callbackCall(chromeLike?.tabs?.query?.bind(chromeLike.tabs), { url: BOSS_URLS });
      const existing = Array.isArray(tabs) ? tabs.find((tab) => tab?.id != null) : null;
      if (existing) {
        return {
          id: existing.id,
          url: existing.url || ''
        };
      }
      const created = await callbackCall(chromeLike?.tabs?.create?.bind(chromeLike.tabs), { url, active: true });
      return {
        id: created.id,
        url: created.url || url
      };
    }

    async function cmdNavigate(params = {}) {
      const targetUrl = params.url || DEFAULT_BOSS_URL;
      const tab = params.tabId ? { id: params.tabId } : await getOrOpenBossTab(targetUrl);
      await safeTabsUpdate(tab.id, { url: targetUrl, active: true });
      return null;
    }

    async function ensureChatTab() {
      const tab = await getOrOpenBossTab(DEFAULT_CHAT_URL);
      if (!/\/web\/chat/i.test(tab.url || '') || /recommend/i.test(tab.url || '')) {
        await safeTabsUpdate(tab.id, { url: DEFAULT_CHAT_URL, active: true });
        await delay(1200);
        return { id: tab.id, url: DEFAULT_CHAT_URL };
      }
      return tab;
    }

    async function ensureRecommendTab() {
      const tab = await getOrOpenBossTab(DEFAULT_BOSS_URL);
      if (!/\/web\/geek\/recommend/i.test(tab.url || '')) {
        await safeTabsUpdate(tab.id, { url: DEFAULT_BOSS_URL, active: true });
        await delay(1200);
        return { id: tab.id, url: DEFAULT_BOSS_URL };
      }
      return tab;
    }

    async function executeMainWorld(func, args = [], params = {}) {
      const tab = params.tabId ? { id: params.tabId } : await getOrOpenBossTab(params.url || DEFAULT_BOSS_URL);
      return executeMainWorldOnTab(tab.id, func, args);
    }

    async function executeMainWorldOnTab(tabId, func, args = []) {
      const results = await callbackCall(chromeLike?.scripting?.executeScript?.bind(chromeLike.scripting), {
        target: { tabId },
        world: 'MAIN',
        func: (helperSource, funcSource, execArgs) => {
          try {
            return new Function('__args', `${helperSource}\nconst __target = (${funcSource});\nreturn __target(...__args);`)(execArgs);
          } catch (error) {
            return {
              __boss_error: error?.message || String(error),
              stack: error?.stack || ''
            };
          }
        },
        args: [PAGE_HELPERS_SOURCE, String(func), args]
      });
      const result = Array.isArray(results) ? results[0]?.result : results;
      if (result && typeof result === 'object' && result.__boss_error) {
        throw new Error(result.__boss_error);
      }
      return result ?? null;
    }

    async function queryBossTabs() {
      const tabs = await callbackCall(chromeLike?.tabs?.query?.bind(chromeLike.tabs), { url: BOSS_URLS });
      return Array.isArray(tabs) ? tabs.filter((tab) => tab?.id != null) : [];
    }

    async function getBossUserInfo() {
      const tabs = await queryBossTabs();
      for (const tab of tabs) {
        try {
          const info = await executeMainWorldOnTab(tab.id, domGetBossUserInfo);
          if (info?.username) {
            return {
              username: info.username,
              vip: Boolean(info.vip),
              tabId: tab.id,
              url: tab.url || '',
              checkedAt: new Date().toISOString()
            };
          }
        } catch (error) {
          // Keep probing other BOSS tabs.
        }
      }
      return {
        username: null,
        vip: false,
        checkedAt: new Date().toISOString()
      };
    }

    async function getBossTabCounts() {
      const tabs = await queryBossTabs();
      const chatTab = tabs.find((tab) => /\/web\/chat/i.test(tab.url || '') && !/recommend/i.test(tab.url || ''));
      if (!chatTab) return { _notOnChat: true };
      try {
        return await executeMainWorldOnTab(chatTab.id, domGetBossTabCounts) || { _notOnChat: true };
      } catch (error) {
        return { _notOnChat: true, error: error.message || String(error) };
      }
    }

    async function getBossStatus() {
      const [userInfo, tabCounts] = await Promise.all([
        getBossUserInfo(),
        getBossTabCounts()
      ]);
      const newGreeting = tabCounts?.['新招呼'] || tabCounts?.newGreeting || {};
      return {
        loggedIn: Boolean(userInfo?.username),
        user: userInfo?.username || '',
        vip: Boolean(userInfo?.vip),
        newGreetingCount: Number(newGreeting.count || 0),
        tabCounts,
        lastCheckedAt: new Date().toISOString()
      };
    }

    async function applyProactivePageFilters(settings = {}, params = {}) {
      const screening = settings.proactive_screening || settings || {};
      const tab = params.tabId ? { id: params.tabId } : await ensureRecommendTab();
      return executeMainWorldOnTab(tab.id, domApplyProactivePageFilters, [screening]);
    }

    async function scanCandidates(params = {}) {
      if (params.mode === 'follow' || (params.mode === 'proactive' && params.subMode === 'followup')) {
        const tab = await ensureChatTab();
        const sessions = await executeMainWorldOnTab(tab.id, domScanSessions);
        return normalizeSessionCandidates(sessions, params);
      }
      if (params.mode === 'proactive' && params.subMode !== 'followup') {
        const tab = await ensureRecommendTab();
        await applyProactivePageFilters(params.settings || {}, { ...params, tabId: tab.id });
        const cards = await executeMainWorldOnTab(tab.id, domScanRecommendCards);
        return normalizeRecommendCandidates(cards).filter((candidate) => candidate.hasGreetBtn);
      }
      const result = await executeMainWorld(domScanCandidates, [params], params);
      return Array.isArray(result) ? result : [];
    }

    async function extractVipFilters(params = {}) {
      const tab = params.tabId ? { id: params.tabId } : await ensureRecommendTab();
      const result = await executeMainWorldOnTab(tab.id, domExtractVipFilters, [params]);
      return result && typeof result === 'object' ? result : { ts: new Date().toISOString(), groups: [] };
    }

    async function sniffDom(params = {}) {
      const result = await executeMainWorld(domSniffDom, [params], params);
      return Array.isArray(result) ? result : [];
    }

    async function captureResume(candidate = {}, params = {}) {
      const result = await executeMainWorld(domCaptureResume, [candidate], params);
      return result || { ...candidate, resumeText: candidate.resumeText || candidate.resume_text || '', source: 'candidate' };
    }

    async function sendCandidateMessage(candidate = {}, decision = {}, params = {}) {
      if (!decision || decision.action === 'skip') {
        return { sent: false, action: 'skip', reason: decision?.reason || 'skipped' };
      }
      const message = String(decision.message || '').trim();
      if (!message) return { sent: false, action: decision.action || '', reason: 'empty message' };
      return executeMainWorld(domSendCandidateMessage, [{ candidate, decision: { ...decision, message } }], params);
    }

    async function greetRecommendCandidate(candidate = {}, decision = {}, params = {}) {
      const geekId = candidate.geekId || candidate.geek_id || candidate.id || candidate.uid;
      const tab = params.tabId ? { id: params.tabId } : await ensureRecommendTab();
      const result = await executeMainWorldOnTab(tab.id, domClickRecommendGreetByGeekId, [geekId]);
      return {
        sent: result === 'ok',
        action: 'contact',
        result,
        message: decision.message || ''
      };
    }

    async function handleDebugCommand(payload = {}) {
      const { method, params = {} } = payload;
      switch (method) {
        case 'navigate':
          return cmdNavigate(params);
        case 'get_url': {
          const tab = await getOrOpenBossTab();
          return tab.url;
        }
        case 'scan_candidates':
          return scanCandidates(params);
        case 'scan_sessions':
          return executeMainWorld(domScanSessions, [], params);
        case 'scan_recommend_cards':
          return executeMainWorld(domScanRecommendCards, [], params);
        case 'chat_state':
          return executeMainWorld(domChatState, [params.greeting || '', params.thank || ''], params);
        case 'click_ask_resume':
          return executeMainWorld(domClickAskResume, [], params);
        case 'click_exchange_wechat':
          return executeMainWorld(domClickExchangeWechat, [], params);
        case 'click_one_consent':
          return executeMainWorld(domClickOneConsent, [], params);
        case 'click_recommend_greet':
          return executeMainWorld(domClickRecommendGreetByGeekId, [params.geekId || params.id || ''], params);
        case 'get_boss_status':
          return getBossStatus();
        case 'capture_resume':
          return captureResume(params.candidate || {}, params);
        case 'send_candidate_message':
          return sendCandidateMessage(params.candidate || {}, params.decision || {}, params);
        case 'apply_proactive_filters':
          return applyProactivePageFilters(params.settings || params, params);
        case 'extract_vip_filters':
          return extractVipFilters(params);
        case 'sniff_dom':
          return sniffDom(params);
        default:
          throw new Error(`Unknown debug method: ${method}`);
      }
    }

    return {
      BOSS_URLS,
      DEFAULT_BOSS_URL,
      applyProactivePageFilters,
      captureResume,
      cmdNavigate,
      ensureChatTab,
      ensureRecommendTab,
      executeMainWorld,
      executeMainWorldOnTab,
      extractVipFilters,
      getBossStatus,
      getBossTabCounts,
      getBossUserInfo,
      getOrOpenBossTab,
      greetRecommendCandidate,
      handleDebugCommand,
      queryBossTabs,
      scanCandidates,
      sendCandidateMessage,
      sniffDom,
      safeTabsUpdate
    };
  }

  function normalizeText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeSessionCandidates(sessions, params = {}) {
    return (Array.isArray(sessions) ? sessions : [])
      .filter((item) => item?.name && item.name !== '群组' && item.name !== '群聊')
      .filter((item) => params.includeRead === true || item.badge)
      .map((item) => {
        const id = item.dataId || `${item.name}|${item.job || ''}`;
        return {
          id,
          uid: id,
          dataId: item.dataId || '',
          source: 'session',
          tab: params.subMode || '',
          candidate_name: item.name,
          name: item.name,
          job_title: item.job || '',
          position: item.job || '',
          lastMsg: item.lastMsg || '',
          resumeText: item.lastMsg || `${item.name} ${item.job || ''}`.trim(),
          hasUnread: Boolean(item.badge),
          sessionIndex: item.index
        };
      });
  }

  function normalizeRecommendCandidates(cards) {
    return (Array.isArray(cards) ? cards : []).map((item) => {
      const id = item.geekId || item.name || `idx:${item.index}`;
      const school = Array.isArray(item.schools) ? item.schools[0] || '' : '';
      const company = Array.isArray(item.companies) ? item.companies[0] || '' : '';
      return {
        id,
        uid: id,
        geekId: item.geekId || '',
        source: 'recommend',
        candidate_name: item.name || '',
        name: item.name || '',
        age: item.age || undefined,
        school,
        education: school,
        schools: Array.isArray(item.schools) ? item.schools : [],
        company,
        company_name: company,
        companies: Array.isArray(item.companies) ? item.companies : [],
        years: item.years,
        yearsLabel: item.yearsLabel || '',
        hasGreetBtn: Boolean(item.hasGreetBtn),
        resumeText: [
          item.name,
          item.age ? `${item.age}岁` : '',
          item.yearsLabel || '',
          ...(Array.isArray(item.schools) ? item.schools : []),
          ...(Array.isArray(item.companies) ? item.companies : [])
        ].filter(Boolean).join(' ')
      };
    }).filter((candidate) => candidate.candidate_name || candidate.resumeText);
  }

  function firstText(root, selectors) {
    for (const selector of selectors) {
      const el = root?.querySelector?.(selector);
      const text = normalizeText(el?.textContent || el?.innerText || el?.value);
      if (text) return text;
    }
    return '';
  }

  function firstAttr(root, attrs) {
    for (const attr of attrs) {
      const value = root?.getAttribute?.(attr);
      if (value) return String(value);
    }
    return '';
  }

  function extractAge(text) {
    const match = normalizeText(text).match(/(?:^|[^\d])([1-6]\d)\s*岁/);
    return match ? Number(match[1]) : undefined;
  }

  function isOnlineResumeText(text) {
    const value = normalizeText(text);
    return /在线简历/.test(value) && !/(暂无|没有|无|未开放)\s*在线简历/.test(value);
  }

  function uniqueList(items) {
    const seen = new Set();
    const out = [];
    for (const item of items || []) {
      const value = normalizeText(item);
      if (!value || value === '不限' || seen.has(value)) continue;
      seen.add(value);
      out.push(value);
    }
    return out;
  }

  function queryAllSafe(selector) {
    try {
      return Array.from(document.querySelectorAll(selector) || []);
    } catch (error) {
      return [];
    }
  }

  function collectOptionTexts(selectors) {
    const values = [];
    for (const selector of selectors) {
      for (const node of queryAllSafe(selector)) values.push(textOfClickable(node));
    }
    return uniqueList(values).slice(0, 80).map((text) => ({ text }));
  }

  function domExtractVipFilters() {
    const groups = [
      {
        key: 'major',
        label: '专业',
        options: collectOptionTexts([
          '[data-key*="major" i]',
          '[data-filter*="major" i]',
          '[data-type*="major" i]',
          '[class*="major" i] label',
          '[class*="major" i] li',
          '[class*="major" i] button',
          '[class*="major" i] [role="option"]'
        ])
      },
      {
        key: 'keyword1',
        label: '牛人关键词',
        options: collectOptionTexts([
          '[data-key*="keyword" i]',
          '[data-filter*="keyword" i]',
          '[data-type*="keyword" i]',
          '[data-key*="tag" i]',
          '[class*="keyword" i] label',
          '[class*="keyword" i] li',
          '[class*="keyword" i] button',
          '[class*="keyword" i] [role="option"]',
          '[class*="tag" i] label',
          '[class*="tag" i] li',
          '[class*="tag" i] button',
          '[class*="tag" i] [role="option"]'
        ])
      }
    ];
    return {
      ts: new Date().toISOString(),
      groups
    };
  }

  function classTokens(value) {
    if (!value) return [];
    if (typeof value === 'string') return value.split(/\s+/).filter(Boolean).slice(0, 4);
    if (value.baseVal) return String(value.baseVal).split(/\s+/).filter(Boolean).slice(0, 4);
    return [];
  }

  function safeIdentifier(value) {
    return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function nodeSelector(node) {
    const tag = String(node?.tagName || 'node').toLowerCase();
    const id = node?.id ? `#${safeIdentifier(node.id)}` : '';
    const classes = classTokens(node?.className).map((name) => `.${safeIdentifier(name)}`).join('');
    return `${tag}${id}${classes}`;
  }

  function serializeNode(node, depth, options = {}) {
    const text = normalizeText(node?.textContent || '').slice(0, 500);
    const children = depth > 0
      ? Array.from(node?.children || []).map((child) => serializeNode(child, depth - 1, options)).filter(Boolean)
      : [];
    if (options.stripEmpty && !text && children.length === 0) return null;
    const out = {
      selector: nodeSelector(node)
    };
    if (text) out.text = text;
    const role = node?.getAttribute?.('role');
    const title = node?.getAttribute?.('title');
    const aria = node?.getAttribute?.('aria-label');
    if (role || title || aria) {
      out.attrs = {};
      if (role) out.attrs.role = role;
      if (title) out.attrs.title = title;
      if (aria) out.attrs.ariaLabel = aria;
    }
    if (children.length) out.children = children;
    return out;
  }

  function domSniffDom(params = {}) {
    const rootSelector = String(params.rootSelector || 'body').trim() || 'body';
    const maxDepth = Math.min(20, Math.max(1, Number(params.maxDepth || 8)));
    const maxRoots = Math.max(0, Number(params.maxRoots || 0));
    const stripEmpty = params.stripEmpty !== false;
    const roots = queryAllSafe(rootSelector).slice(0, maxRoots > 0 ? maxRoots : undefined);
    const nodes = roots.map((node) => serializeNode(node, maxDepth, { stripEmpty })).filter(Boolean);
    return [{
      frameId: 0,
      url: document.location?.href || (typeof location !== 'undefined' ? location.href : ''),
      rootSelector,
      nodes
    }];
  }

  function filterValuesFromScreening(screening = {}) {
    const pageFilters = screening.page_filters || {};
    const vipFilters = screening.vip_filters || {};
    const values = [];
    values.push(...uniqueList(pageFilters.edu));
    values.push(...uniqueList(pageFilters.intention));
    values.push(...uniqueList([pageFilters.salary]));
    values.push(...uniqueList(pageFilters.experience));
    values.push(...uniqueList(pageFilters.callPhone));

    for (const value of Object.values(vipFilters)) {
      if (Array.isArray(value)) values.push(...uniqueList(value));
      else values.push(...uniqueList([value]));
    }
    return uniqueList(values);
  }

  function candidateClickTargets() {
    const selector = [
      'button',
      'label',
      'li',
      'span',
      'a',
      '[role="button"]',
      '[role="option"]',
      '[class*="filter"]',
      '[class*="select"]',
      '[class*="option"]'
    ].join(',');
    return Array.from(document.querySelectorAll(selector) || [])
      .filter(Boolean)
      .sort((left, right) => normalizeText(left.textContent).length - normalizeText(right.textContent).length);
  }

  function textOfClickable(node) {
    const attrs = ['title', 'aria-label', 'data-value', 'value'];
    const attrText = attrs.map((attr) => node.getAttribute?.(attr)).find(Boolean);
    return normalizeText(attrText || node.textContent || node.innerText || node.value);
  }

  function findFilterOption(value) {
    const target = normalizeText(value);
    if (!target) return null;
    return candidateClickTargets().find((node) => {
      const text = textOfClickable(node);
      if (!text) return false;
      if (text === target) return true;
      return text.includes(target) && text.length <= target.length + 12;
    }) || null;
  }

  function clickPageElement(element) {
    element.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    element.dispatchEvent?.(createEvent('mousedown', { bubbles: true, cancelable: true }));
    element.dispatchEvent?.(createEvent('mouseup', { bubbles: true, cancelable: true }));
    element.click?.();
    element.dispatchEvent?.(createEvent('click', { bubbles: true, cancelable: true }));
  }

  function domApplyProactivePageFilters(screening = {}) {
    const applied = [];
    const missing = [];
    const clickedElements = new Set();
    for (const value of filterValuesFromScreening(screening)) {
      const target = findFilterOption(value);
      if (!target) {
        missing.push(value);
        continue;
      }
      if (!clickedElements.has(target)) {
        clickPageElement(target);
        clickedElements.add(target);
      }
      applied.push(value);
    }
    return { applied, missing };
  }

  function domScanCandidates(params = {}) {
    const cardSelectors = params.candidateSelectors || [
      '.candidate-card-wrap',
      '.geek-card',
      '.geek-item-wrap',
      '.geek-item',
      '.candidate-card',
      '[data-geek-id]',
      '[data-geekid]',
      '[data-id]'
    ];
    const cards = [];
    const seenElements = new Set();
    for (const selector of cardSelectors) {
      const nodes = Array.from(document.querySelectorAll(selector) || []);
      for (const node of nodes) {
        if (seenElements.has(node)) continue;
        seenElements.add(node);
        cards.push(node);
      }
    }

    const candidates = cards.map((card, index) => {
      const resumeText = normalizeText(card.textContent || '');
      const name = firstText(card, ['.geek-name', '.candidate-name', '.name', '[class*="name"]']) || '';
      const jobTitle = firstText(card, ['.job-title', '.position-name', '.expect-position', '[class*="job"]', '[class*="position"]']) || '';
      const school = firstText(card, ['.school', '.education', '.edu-exp', '[class*="school"]', '[class*="edu"]']) || '';
      const company = firstText(card, ['.company', '.work-company', '.work-exp', '[class*="company"]', '[class*="work"]']) || '';
      const id = firstAttr(card, ['data-geek-id', 'data-geekid', 'data-id', 'data-uid']) || name || `idx:${index}`;
      const age = extractAge(resumeText);
      const hasOnlineResume = isOnlineResumeText(resumeText);
      return {
        id,
        uid: id,
        candidate_name: name,
        name,
        job_title: jobTitle,
        position: jobTitle,
        school,
        education: school,
        company,
        company_name: company,
        age,
        hasOnlineResume,
        resumeText
      };
    }).filter((candidate) => candidate.candidate_name || candidate.resumeText);

    if (params.mode === 'proactive' && params.subMode !== 'followup') {
      return candidates.filter((candidate) => candidate.hasOnlineResume);
    }
    return candidates;
  }

  function domScanSessions() {
    let nodes = Array.from(document.querySelectorAll('.geek-item-wrap') || []);
    if (!nodes.length) nodes = Array.from(document.querySelectorAll('.geek-item') || []);
    return nodes.map((node, index) => {
      const item = node.classList?.contains?.('geek-item') ? node : node.querySelector?.('.geek-item');
      const unread = node.querySelector?.('.unread-tips, .badge-count');
      return {
        index,
        dataId: item?.getAttribute?.('data-id') || item?.id || node.getAttribute?.('data-id') || node.id || '',
        name: firstText(node, ['.geek-name']),
        job: firstText(node, ['.source-job']),
        badge: Boolean(unread && (unread.offsetWidth > 0 || unread.offsetHeight > 0 || unread.getClientRects?.().length > 0)),
        lastMsg: firstText(node, ['.push-text'])
      };
    });
  }

  function domScanRecommendCards() {
    return Array.from(document.querySelectorAll('.candidate-card-wrap') || []).map((card, index) => {
      const inner = card.querySelector?.('.card-inner');
      const baseInfo = card.querySelector?.('.base-info');
      const years = extractYears(baseInfo);
      return {
        index,
        geekId: inner?.dataset?.geek || inner?.dataset?.geekid || '',
        name: firstText(card, ['.name', '.geek-name', '[class*="name"]']),
        age: extractAge(baseInfo?.textContent || card.textContent || '') || 0,
        schools: Array.from(card.querySelectorAll?.('.edu-exps .timeline-item .content') || [])
          .map((node) => firstText(node, ['span']) || normalizeText(node.textContent))
          .filter(Boolean),
        companies: Array.from(card.querySelectorAll?.('.work-exps .timeline-item .content') || [])
          .map((node) => firstText(node, ['span']) || normalizeText(node.textContent))
          .filter(Boolean),
        years: years.years,
        yearsLabel: years.label,
        hasGreetBtn: Boolean(card.querySelector?.('.btn-greet'))
      };
    });
  }

  function domChatState(greeting = '', thank = '') {
    const state = {
      pendingConsent: 0,
      attachResumeReady: false,
      attachResumePending: false,
      greetingSent: false,
      alreadyThanked: false,
      hasBossMessage: false,
      bossInitiated: false,
      geekMessages: [],
      hasInteraction: false,
      wechatExchangePending: false,
      wechatRequestSent: false,
      wechatDone: false
    };
    const box = document.querySelector('.conversation-box');
    if (!box) return state;
    let firstSpeakerSeen = false;
    for (const item of Array.from(box.querySelectorAll('[class*=item-myself], [class*=item-friend], [class*=item-other]') || [])) {
      const className = String(item.className || '');
      const text = normalizeText(item.innerText || item.textContent).slice(0, 300);
      const isCandidate = className.includes('friend') || className.includes('other');
      if (!firstSpeakerSeen && (className.includes('myself') || isCandidate)) {
        state.bossInitiated = className.includes('myself');
        firstSpeakerSeen = true;
      }
      if (className.includes('myself')) {
        state.hasBossMessage = true;
        if (greeting && text.includes(greeting)) state.greetingSent = true;
        if (thank && text.includes(thank)) state.alreadyThanked = true;
      }
      if (isCandidate) {
        state.hasInteraction = true;
        if (!item.querySelector?.('.message-card-wrap')) state.geekMessages.push(text);
      }
    }
    for (const item of Array.from(box.querySelectorAll('[class*=item-system]') || [])) {
      const text = normalizeText(item.textContent);
      if (/拒绝|更换了|交换微信|交换电话|预览/.test(text)) {
        state.hasInteraction = true;
        break;
      }
    }
    if (!state.hasInteraction && box.querySelector('.message-card-wrap')) state.hasInteraction = true;
    const resumeButton = document.querySelector('.btn.resume-btn-file');
    if (resumeButton) {
      state.attachResumeReady = resumeButton.tagName === 'A' && !resumeButton.classList?.contains?.('disabled');
      state.attachResumePending = !state.attachResumeReady;
    }
    for (const notice of Array.from(document.querySelectorAll('.notice-list.notice-blue-list') || [])) {
      const text = notice.textContent || '';
      if (text.includes('交换微信')) {
        state.wechatExchangePending = true;
        continue;
      }
      for (const button of Array.from(notice.querySelectorAll('a.btn, .btn') || [])) {
        if (normalizeText(button.innerText || button.textContent) === '同意') state.pendingConsent += 1;
      }
    }
    if (!state.wechatExchangePending) {
      for (const card of Array.from(document.querySelectorAll('.message-card-wrap') || [])) {
        if (!(card.textContent || '').includes('交换微信')) continue;
        const button = card.querySelector('.card-btn:not(.disabled)');
        const text = normalizeText(button?.innerText || button?.textContent);
        if (text === '同意' || text === '拒绝') {
          state.wechatExchangePending = true;
          break;
        }
      }
    }
    const allText = box.innerText || box.textContent || '';
    state.wechatRequestSent = /请求交换微信已发送|请求交换手机号已发送/.test(allText);
    state.wechatDone = state.wechatRequestSent ||
      (/同意了/.test(allText) && /交换微信/.test(allText)) ||
      (/拒绝了/.test(allText) && /交换微信/.test(allText)) ||
      /已添加微信|已交换微信/.test(allText);
    return state;
  }

  function domClickAskResume() {
    for (const node of Array.from(document.querySelectorAll('span.operate-btn') || [])) {
      if ((node.innerText || node.textContent || '').includes('求简历')) {
        clickPageElement(node);
        return 'ok';
      }
    }
    return 'no_btn';
  }

  function domClickExchangeWechat() {
    for (const node of Array.from(document.querySelectorAll('span.operate-btn') || [])) {
      if (normalizeText(node.innerText || node.textContent) === '换微信') {
        clickPageElement(node);
        return 'ok';
      }
    }
    return 'no_btn';
  }

  function domClickOneConsent() {
    for (const notice of Array.from(document.querySelectorAll('.notice-list.notice-blue-list') || [])) {
      if ((notice.textContent || '').includes('交换微信')) continue;
      for (const button of Array.from(notice.querySelectorAll('a.btn, .btn') || [])) {
        if (normalizeText(button.innerText || button.textContent) === '同意') {
          clickPageElement(button);
          return 'ok';
        }
      }
    }
    for (const button of Array.from(document.querySelectorAll('.message-card-wrap .card-btn') || [])) {
      if (normalizeText(button.innerText || button.textContent) === '同意' && !button.classList?.contains?.('disabled')) {
        clickPageElement(button);
        return 'ok';
      }
    }
    return 'none';
  }

  function domClickRecommendGreetByGeekId(geekId) {
    if (!geekId) return 'no_geek_id';
    for (const card of Array.from(document.querySelectorAll('.candidate-card-wrap') || [])) {
      const inner = card.querySelector('.card-inner');
      const id = inner?.dataset?.geek || inner?.dataset?.geekid || '';
      if (id !== geekId) continue;
      card.scrollIntoView?.({ behavior: 'smooth', block: Math.random() > 0.3 ? 'center' : 'nearest' });
      const button = card.querySelector('.btn-greet');
      if (!button) return 'no_btn';
      clickPageElement(button);
      return 'ok';
    }
    return 'not_found';
  }

  function extractYears(node) {
    const text = normalizeText(node?.textContent || '').replace(/^\d+岁/, '');
    if (!text) return { years: -2, label: '' };
    const special = ['在校/应届', '25年毕业', '26年毕业', '26年后毕业'];
    for (const label of special) {
      if (text.startsWith(label)) return { years: -1, label };
    }
    if (text.startsWith('1年以内') || text.startsWith('1年内')) return { years: 0, label: '1年以内' };
    if (text.startsWith('10年以上')) return { years: 10, label: '10年以上' };
    const yearMatch = text.match(/^(\d+)年/);
    if (yearMatch) return { years: Number(yearMatch[1]), label: yearMatch[0] };
    const monthMatch = text.match(/^(\d+)个月/);
    if (monthMatch) return { years: 0, label: monthMatch[0] };
    return { years: -2, label: '' };
  }

  function domCaptureResume(candidate = {}) {
    const selectors = [
      '.resume-content-wrap',
      '.resume-content',
      '.dialog-lib-resume',
      '.geek-info-wrap',
      '.resume-detail',
      '[class*="resume"]',
      '[class*="geek-info"]'
    ];
    const resumeText = firstText(document, selectors) || candidate.resumeText || candidate.resume_text || normalizeText(document.body?.textContent) || '';
    const age = candidate.age ?? extractAge(resumeText);
    return {
      ...candidate,
      age,
      resumeText,
      resume_text: resumeText,
      source: resumeText ? 'dom' : 'candidate'
    };
  }

  function createEvent(name, options = {}) {
    try {
      if (name === 'input' && typeof InputEvent === 'function') return new InputEvent(name, options);
    } catch (_) {}
    try {
      return new Event(name, options);
    } catch (_) {
      return { type: name, ...options };
    }
  }

  function findSendButton() {
    const directSelectors = [
      '.submit.active',
      'div.submit.active',
      '.btn-send',
      '.send-btn',
      '.boss-chat-send',
      '[class*="send"]',
      'button[type="submit"]'
    ];
    for (const selector of directSelectors) {
      const button = document.querySelector(selector);
      if (button) return button;
    }
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], .btn') || []);
    return buttons.find((button) => /发送|打招呼|回复|send/i.test(normalizeText(button.textContent))) || null;
  }

  function setEditorText(editor, message) {
    editor.focus?.();
    const editable = editor.isContentEditable || editor.getAttribute?.('contenteditable') === 'true';
    if (editable) {
      editor.textContent = message;
      editor.innerText = message;
    } else {
      editor.value = message;
    }
    editor.dispatchEvent?.(createEvent('input', { bubbles: true, data: message, inputType: 'insertText' }));
    editor.dispatchEvent?.(createEvent('change', { bubbles: true }));
  }

  function domSendCandidateMessage(payload = {}) {
    const decision = payload.decision || {};
    const action = decision.action || '';
    const message = normalizeText(decision.message);
    if (!message) return { sent: false, action, reason: 'empty message' };

    const editor = document.querySelector('#boss-chat-editor-input, [contenteditable="true"], [contenteditable=true], .chat-editor [contenteditable], .input-area [contenteditable], .boss-chat-editor-input, textarea, [class*="editor"], [class*="input"]');
    if (!editor) return { sent: false, action, reason: 'message editor not found' };
    setEditorText(editor, message);

    const sendButton = findSendButton();
    if (!sendButton) return { sent: false, action, reason: 'send button not found' };
    sendButton.dispatchEvent?.(createEvent('mousedown', { bubbles: true, cancelable: true }));
    sendButton.dispatchEvent?.(createEvent('mouseup', { bubbles: true, cancelable: true }));
    sendButton.click?.();
    sendButton.dispatchEvent?.(createEvent('click', { bubbles: true, cancelable: true }));
    return { sent: true, action };
  }

  function domGetBossUserInfo() {
    const selectors = [
      'a[ka="header-username"] .label-text',
      '.nav-logout .user-name',
      '.user-info .user-name',
      '[class*="user-name"]',
      'a[ka="menu_dropdown_signout"]'
    ];
    let username = null;
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const text = normalizeText(node?.textContent);
      if (text) {
        username = text;
        break;
      }
    }
    let vip = Boolean(document.querySelector('i.icon-vip, img.vip-icon-v2'));
    if (!vip) {
      for (const frame of Array.from(document.querySelectorAll('iframe') || [])) {
        try {
          const doc = frame.contentDocument;
          if (doc?.querySelector?.('i.icon-vip, img.vip-icon-v2')) {
            vip = true;
            break;
          }
        } catch (error) {
          // Cross-origin iframes are expected.
        }
      }
    }
    return { username, vip };
  }

  function domGetBossTabCounts() {
    const counts = {};
    const items = Array.from(document.querySelectorAll('.chat-label-item') || []);
    if (!items.length) return null;
    for (const item of items) {
      const title = item.getAttribute('title') || '';
      const countMatch = title.match(/\((\d+)\)/);
      const label = title.replace(/\(\d+\)/, '').trim();
      const count = countMatch ? Number(countMatch[1]) : 0;
      const hasUnread = Boolean(item.querySelector('.badge-dot')) || count > 0;
      if (label) counts[label] = { count, hasUnread };
    }
    return counts;
  }

  const api = {
    BOSS_URLS,
    DEFAULT_BOSS_URL,
    createBrowserOps
  };

  root.BHPBrowserOps = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
