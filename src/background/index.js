(function initBackgroundModule(root) {
  'use strict';

  const MODULE_PATHS = [
    '../modules/settings.js',
    '../modules/storage.js',
    '../modules/permissions.js',
    '../modules/filters.js',
    '../modules/messaging.js',
    '../modules/byo-provider.js',
    '../modules/ai-rating.js',
    '../modules/browser-ops.js',
    '../modules/automation.js',
    '../modules/net-logger.js'
  ];

  if (typeof importScripts === 'function' && !root.BHPSettings) {
    importScripts(...MODULE_PATHS);
  }

  function normalizeMessageError(error) {
    return {
      ok: false,
      error: {
        code: error?.code || 'internal_error',
        message: error?.message || 'Unknown error',
        retriable: Boolean(error?.retriable)
      }
    };
  }

  function callbackApi(fn, fallback) {
    return new Promise((resolve, reject) => {
      if (typeof fn !== 'function') {
        resolve(fallback);
        return;
      }
      try {
        fn((result) => {
          const runtimeError = root.chrome?.runtime?.lastError;
          if (runtimeError) reject(new Error(runtimeError.message || String(runtimeError)));
          else resolve(result);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function permissionPatternToOrigin(pattern) {
    try {
      return new URL(String(pattern || '').replace(/\*.*$/, '')).origin;
    } catch (error) {
      return '';
    }
  }

  function buildMessageTemplatePrompt(settings = {}) {
    const pro = settings.proactive_screening || {};
    const messages = settings.messages || {};
    const contactGrades = Array.isArray(settings.contact_grades) ? settings.contact_grades.join('/') : 'A/B';
    return [
      '你是招聘 HR 助手，请为 BOSS 直聘自动沟通生成简洁、礼貌、不过度承诺的话术模板。',
      '只输出 JSON，不要 Markdown，不要解释。',
      'JSON schema:',
      '{"greeting":"首次招呼","thank":"评级未通过感谢话术","contact":"通过后交换微信话术","contact_no_wechat":"通过后仅回复话术","job_closed":"岗位关闭拒绝语","proactive_followup":"主动打招呼后对方回复时的跟进话术"}',
      '',
      '要求：',
      '- 每段 1 到 2 句，适合中文招聘场景。',
      '- 不承诺 offer、薪资、面试结果。',
      '- 可以使用占位符：{name}、{position}、{company}、{rating}、{rating_summary}、{reason}。',
      '- thank 要表达认真看过简历，但不把系统失败说成候选人不合适。',
      `- 触发邀约评级：${contactGrades || 'A/B'}。`,
      `- 年龄上限：${settings.age_max || 30}。`,
      `- 牛人筛选年龄上限：${pro.age_max || 30}。`,
      '',
      '当前已有话术，可参考但不要机械复制：',
      `首次招呼：${messages.greeting || ''}`,
      `感谢话术：${messages.thank || ''}`,
      `交换微信：${messages.contact || ''}`,
      `仅回复：${messages.contact_no_wechat || ''}`,
      `岗位关闭：${messages.job_closed || ''}`,
      `牛人跟进：${pro.followup_msg || ''}`
    ].join('\n');
  }

  function createBackground(deps = {}) {
    const chromeLike = deps.chrome || root.chrome;
    const settingsModule = deps.settings || root.BHPSettings;
    const storageModule = deps.storage || root.BHPStorage;
    const permissionsModule = deps.permissions || root.BHPPermissions;
    const byoProvider = deps.byoProvider || root.BHPByoProvider;
    const netLogger = deps.netLogger || root.BHPNetLogger?.createNetLogger?.({
      chrome: chromeLike,
      onLogout: (entry) => handleNetworkLogout(entry)
    }) || null;
    const browserOps = deps.browserOps || root.BHPBrowserOps?.createBrowserOps?.({ chrome: chromeLike }) || null;
    let automation = deps.automation || null;

    const autoCtx = {
      running: false,
      abort: false,
      mode: '',
      subMode: '',
      lastText: '',
      lastStats: '',
      startedAt: ''
    };

    function syncAutoCtxFromAutomation() {
      if (!automation?.ctx) return;
      autoCtx.running = Boolean(automation.ctx.running);
      autoCtx.abort = Boolean(automation.ctx.abort);
      autoCtx.mode = automation.ctx.mode || '';
      autoCtx.subMode = automation.ctx.subMode || '';
      autoCtx.lastText = automation.ctx.lastText || '';
      autoCtx.lastStats = automation.ctx.lastStats || '';
      autoCtx.startedAt = automation.ctx.startedAt || '';
    }

    async function storageGet(keys) {
      if (!chromeLike?.storage?.local) return {};
      return chromeLike.storage.local.get(keys);
    }

    async function storageSet(values) {
      if (chromeLike?.storage?.local) await chromeLike.storage.local.set(values);
    }

    async function storageRemove(keys) {
      if (chromeLike?.storage?.local?.remove) await chromeLike.storage.local.remove(keys);
    }

    function normalizeBossStatus(status = {}, previous = {}, source = 'unknown') {
      const hasLoggedIn = Object.prototype.hasOwnProperty.call(status, 'loggedIn');
      const loggedIn = hasLoggedIn ? Boolean(status.loggedIn) : Boolean(previous.loggedIn);
      return {
        loggedIn,
        user: loggedIn ? String(status.user ?? previous.user ?? '') : String(status.user ?? ''),
        vip: loggedIn ? Boolean(status.vip ?? previous.vip) : Boolean(status.vip ?? false),
        newGreetingCount: Number(status.newGreetingCount ?? previous.newGreetingCount ?? 0) || 0,
        tabCounts: status.tabCounts || previous.tabCounts || {},
        lastCheckedAt: status.lastCheckedAt || new Date().toISOString(),
        source
      };
    }

    function notifyBossStatusChanged(bossStatus, reason, extra = {}) {
      try {
        chromeLike?.runtime?.sendMessage?.({
          type: 'BOSS_STATUS_CHANGED',
          payload: {
            reason,
            bossStatus,
            ...extra
          }
        });
      } catch (error) {
        // Side panel refresh is best-effort; storage remains the source of truth.
      }
    }

    async function updateBossStatus(status, reason, extra = {}) {
      const data = await storageGet('bossStatus');
      const bossStatus = normalizeBossStatus(status, data.bossStatus || {}, reason);
      await storageSet({ bossStatus });
      notifyBossStatusChanged(bossStatus, reason, extra);
      return bossStatus;
    }

    function statusFromPagePayload(payload = {}) {
      if (payload.bossStatus && typeof payload.bossStatus === 'object') return payload.bossStatus;
      if (
        Object.prototype.hasOwnProperty.call(payload, 'loggedIn') ||
        Object.prototype.hasOwnProperty.call(payload, 'user') ||
        Object.prototype.hasOwnProperty.call(payload, 'vip') ||
        Object.prototype.hasOwnProperty.call(payload, 'newGreetingCount')
      ) {
        return payload;
      }
      const url = String(payload.url || '');
      const title = String(payload.title || '');
      if (/zhipin\.com/i.test(url) && (/login|logout/i.test(url) || /登录|注册/.test(title))) {
        return {
          loggedIn: false,
          user: '',
          vip: false,
          newGreetingCount: 0,
          tabCounts: {}
        };
      }
      return null;
    }

    async function handlePageStatus(payload = {}) {
      const nextStatus = statusFromPagePayload(payload);
      if (nextStatus) {
        await updateBossStatus(nextStatus, 'page_status', {
          url: payload.url || '',
          title: payload.title || ''
        });
      }
      return { ok: true };
    }

    async function handleNetworkLogout(entry = {}) {
      await netLogger?.persist?.('logout');
      await updateBossStatus({
        loggedIn: false,
        user: '',
        vip: false,
        newGreetingCount: 0,
        tabCounts: {},
        lastCheckedAt: new Date().toISOString()
      }, 'network_logout', { netLogEntry: entry });
    }

    async function getNetLogSnapshot() {
      await netLogger?.restore?.();
      return netLogger?.snapshot ? netLogger.snapshot() : [];
    }

    async function clearNetLogSnapshot() {
      const result = netLogger?.clear ? netLogger.clear() : 'cleared';
      await netLogger?.persist?.('clear');
      return result;
    }

    async function getSettings() {
      const data = await storageGet('settings');
      return settingsModule.mergeSettings(data.settings || {});
    }

    async function saveSettings(nextSettings) {
      const settings = settingsModule.mergeSettings(nextSettings || {});
      await storageSet({ settings });
      return settings;
    }

    async function getDailyUsage() {
      const data = await storageGet(storageModule.DAILY_USAGE_KEY || 'dailyUsage');
      return storageModule.normalizeDailyUsage(data[storageModule.DAILY_USAGE_KEY || 'dailyUsage']);
    }

    async function saveDailyUsage(usage) {
      const normalized = storageModule.normalizeDailyUsage(usage);
      await storageSet({ [storageModule.DAILY_USAGE_KEY || 'dailyUsage']: normalized });
      return normalized;
    }

    async function incrementDailyUsage(field) {
      const current = await getDailyUsage();
      current[field] = Number(current[field] || 0) + 1;
      return saveDailyUsage(current);
    }

    async function saveRunState(runState) {
      await storageSet({ runState });
      return runState;
    }

    async function getRunState() {
      const data = await storageGet('runState');
      return data.runState || null;
    }

    async function getPauseState() {
      const key = storageModule.PAUSE_STATE_KEY || 'autoPauseState';
      const data = await storageGet(key);
      const pauseState = data[key] || null;
      if (!pauseState?.ts) return null;
      const expiresAt = Number(pauseState.ts) + Number(pauseState.ttlMs || storageModule.PAUSE_TTL_MS || 15 * 60 * 1000);
      if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
        await storageRemove(key);
        return null;
      }
      return {
        ...pauseState,
        ttlRemainingMs: Number.isFinite(expiresAt) ? Math.max(0, expiresAt - Date.now()) : 0,
        paused: true
      };
    }

    async function clearPauseState() {
      await storageRemove(storageModule.PAUSE_STATE_KEY || 'autoPauseState');
      return { ok: true };
    }

    function isRestorableRunState(runState) {
      return Boolean(
        runState &&
        runState.running === true &&
        runState.checkpoint?.level === 'list' &&
        !runState.stoppedAt &&
        runState.mode
      );
    }

    async function resumeFromRunStateIfNeeded() {
      syncAutoCtxFromAutomation();
      if (automation?.ctx?.running || autoCtx.running) return false;
      const runState = await getRunState();
      if (!isRestorableRunState(runState) || !automation?.start) return false;
      await automation.start({
        mode: runState.mode === 'proactive' ? 'proactive' : 'follow',
        subMode: String(runState.subMode || ''),
        resume: true
      });
      syncAutoCtxFromAutomation();
      return true;
    }

    async function handleResumeAlarm(alarm) {
      if (alarm?.name !== 'resumeTick') return;
      syncAutoCtxFromAutomation();
      if (automation?.ctx?.running || autoCtx.running) {
        if (automation?.snapshot) await saveRunState(automation.snapshot());
        else {
          await saveRunState({
            running: true,
            mode: autoCtx.mode,
            subMode: autoCtx.subMode,
            startedAt: autoCtx.startedAt,
            lastText: autoCtx.lastText,
            checkpoint: { level: 'list' }
          });
        }
        return;
      }
      await resumeFromRunStateIfNeeded();
    }

    async function getPermissionOrigins() {
      if (!chromeLike?.permissions?.getAll) return [];
      const all = await callbackApi((callback) => chromeLike.permissions.getAll(callback), { origins: [] });
      const origins = (all?.origins || []).map(permissionPatternToOrigin).filter(Boolean);
      return Array.from(new Set(origins)).sort();
    }

    async function getStatus() {
      await resumeFromRunStateIfNeeded();
      syncAutoCtxFromAutomation();
      const [bossData, liveBossStatus, dailyUsage, lastPermData, pauseState] = await Promise.all([
        storageGet('bossStatus'),
        browserOps?.getBossStatus ? browserOps.getBossStatus().catch(() => null) : Promise.resolve(null),
        getDailyUsage(),
        storageGet('lastByoPermission'),
        getPauseState()
      ]);
      const bossStatus = liveBossStatus ? normalizeBossStatus(liveBossStatus, bossData.bossStatus || {}, 'live_probe') : bossData.bossStatus || {};
      if (liveBossStatus) await storageSet({ bossStatus });
      return {
        boss: {
          loggedIn: Boolean(bossStatus.loggedIn),
          user: bossStatus.user || '',
          vip: Boolean(bossStatus.vip),
          newGreetingCount: Number(bossStatus.newGreetingCount || 0),
          tabCounts: bossStatus.tabCounts || {},
          lastCheckedAt: bossStatus.lastCheckedAt || ''
        },
        dailyUsage,
        permissions: {
          byoOrigins: await getPermissionOrigins(),
          lastByoPermission: lastPermData.lastByoPermission || null
        },
        automation: {
          running: autoCtx.running,
          mode: autoCtx.mode || undefined,
          subMode: autoCtx.subMode || undefined,
          lastText: autoCtx.lastText || '',
          lastStats: autoCtx.lastStats || '',
          startedAt: autoCtx.startedAt || undefined
        },
        pause: pauseState || { paused: false },
        settingsReady: true
      };
    }

    async function startAuto(payload = {}) {
      if (automation?.start) {
        const result = await automation.start(payload);
        syncAutoCtxFromAutomation();
        return result;
      }
      if (autoCtx.running) return 'started';
      const mode = payload.mode === 'proactive' ? 'proactive' : 'follow';
      autoCtx.running = true;
      autoCtx.abort = false;
      autoCtx.mode = mode;
      autoCtx.subMode = String(payload.subMode || '');
      autoCtx.startedAt = new Date().toISOString();
      autoCtx.lastText = mode === 'proactive' ? '牛人筛选已启动' : '智能跟进已启动';
      autoCtx.lastStats = '';
      await incrementDailyUsage(mode === 'proactive' ? 'proactive_runs' : 'follow_runs');
      await saveRunState({
        running: true,
        mode: autoCtx.mode,
        subMode: autoCtx.subMode,
        startedAt: autoCtx.startedAt,
        lastText: autoCtx.lastText,
        checkpoint: { level: 'list' }
      });
      return 'started';
    }

    async function stopAuto(reason = 'user') {
      if (automation?.stop) {
        const result = await automation.stop(reason);
        syncAutoCtxFromAutomation();
        return result;
      }
      autoCtx.abort = true;
      autoCtx.running = false;
      autoCtx.lastText = '已停止';
      await saveRunState({
        running: false,
        mode: autoCtx.mode,
        subMode: autoCtx.subMode,
        stoppedAt: new Date().toISOString(),
        reason,
        checkpoint: { level: 'list' }
      });
      return 'stopping';
    }

    async function resumeAuto() {
      if (!automation?.resume) throw new Error('自动化恢复不可用');
      const result = await automation.resume();
      syncAutoCtxFromAutomation();
      return result;
    }

    async function requestByoPermission(url) {
      const result = await permissionsModule.requestByoPermission(chromeLike, url);
      const lastByoPermission = {
        origin: result.origin,
        granted: result.granted,
        alreadyGranted: result.alreadyGranted,
        checkedAt: new Date().toISOString()
      };
      await storageSet({ lastByoPermission });
      return result;
    }

    async function byoTestConnection(payload = {}) {
      if (!payload.url) throw new Error('自定义 AI Base URL 不能为空');
      const permission = await permissionsModule.hasByoPermission(chromeLike, payload.url);
      if (!permission.granted) {
        return {
          success: false,
          multimodal: false,
          detail: `自定义 AI 地址权限未授权：${permission.origin}`
        };
      }
      return byoProvider.testConnection(payload);
    }

    async function byoGenerateTemplates(payload = {}) {
      const rawSettings = payload.settings || await getSettings();
      const settings = settingsModule.mergeSettings(rawSettings);
      const byo = settings.byo || {};
      if (!byo.url || !byo.key || !byo.model) {
        const error = new Error('请先配置自定义 AI');
        error.code = 'byo_not_configured';
        throw error;
      }
      const permission = await permissionsModule.hasByoPermission(chromeLike, byo.url);
      if (!permission.granted) {
        const error = new Error(`自定义 AI 地址权限未授权：${permission.origin}`);
        error.code = 'byo_permission_missing';
        throw error;
      }
      if (!byoProvider?.generateText) throw new Error('自定义 AI 提供器不可用');
      return {
        text: await byoProvider.generateText(byo, buildMessageTemplatePrompt(settings), {
          maxTokens: 1200,
          temperature: 0.45
        })
      };
    }

    function groupOptionTexts(schema = {}, key) {
      const group = (Array.isArray(schema.groups) ? schema.groups : []).find((item) => item?.key === key);
      return (Array.isArray(group?.options) ? group.options : [])
        .map((item) => String(item?.text || item || '').trim())
        .filter(Boolean);
    }

    async function extractVipFilters(payload = {}) {
      if (!browserOps?.extractVipFilters) throw new Error('browser ops unavailable');
      const schema = await browserOps.extractVipFilters(payload);
      const ts = schema?.ts || new Date().toISOString();
      const dynamicOptions = {
        major: groupOptionTexts(schema, 'major'),
        keyword1: groupOptionTexts(schema, 'keyword1'),
        updated_at: ts
      };
      const current = await getSettings();
      await saveSettings(settingsModule.deepMerge(current, {
        proactive_screening: {
          vip_dynamic_options: dynamicOptions
        }
      }));
      return {
        schema: {
          ts,
          groups: Array.isArray(schema?.groups) ? schema.groups : []
        },
        dynamicOptions
      };
    }

    async function sniffDom(payload = {}) {
      if (!browserOps?.sniffDom) throw new Error('browser ops unavailable');
      const results = await browserOps.sniffDom(payload);
      return { results: Array.isArray(results) ? results : [] };
    }

    async function getBossUserInfo() {
      if (!browserOps?.getBossUserInfo) return { username: null, vip: false };
      return browserOps.getBossUserInfo();
    }

    async function getBossTabCounts() {
      if (!browserOps?.getBossTabCounts) return { _notOnChat: true };
      return browserOps.getBossTabCounts();
    }

    async function handleCommand(message = {}) {
      const { type, payload = {} } = message;
      switch (type) {
        case 'GET_STATUS': return getStatus();
        case 'START_AUTO': return startAuto(payload);
        case 'STOP_AUTO': return stopAuto();
        case 'RESUME_AUTO': return resumeAuto();
        case 'GET_PAUSE_STATE': return (await getPauseState()) || { paused: false };
        case 'CLEAR_PAUSE_STATE': return clearPauseState();
        case 'GET_AUTO_STATUS':
          syncAutoCtxFromAutomation();
          return {
            running: autoCtx.running,
            lastText: autoCtx.lastText || '',
            lastStats: autoCtx.lastStats || '',
            snapshot: automation?.snapshot ? automation.snapshot() : undefined,
            pause: await getPauseState() || { paused: false }
          };
        case 'GET_USER_INFO': return getBossUserInfo();
        case 'GET_TAB_COUNTS': return getBossTabCounts();
        case 'SAVE_SETTINGS': return saveSettings(payload.settings);
        case 'GET_SETTINGS': return getSettings();
        case 'REQUEST_BYO_PERMISSION': return requestByoPermission(payload.url);
        case 'BYO_TEST': return byoTestConnection(payload);
        case 'BYO_GENERATE_TEMPLATES': return byoGenerateTemplates(payload);
        case 'EXTRACT_VIP_FILTERS': return extractVipFilters(payload);
        case 'SNIFF_DOM': return sniffDom(payload);
        case 'GET_NET_LOG': return getNetLogSnapshot();
        case 'CLEAR_NET_LOG': return clearNetLogSnapshot();
        case 'DEBUG_CMD':
          if (!browserOps?.handleDebugCommand) throw new Error('browser ops unavailable');
          return browserOps.handleDebugCommand(payload);
        case 'PAGE_STATUS':
          return handlePageStatus(payload);
        case 'BHP_BRIDGE_READY':
        case 'API_RESULT':
          return { ok: true };
        default:
          throw new Error(`Unknown message type: ${type}`);
      }
    }

    async function dispatchMessage(message) {
      try {
        return await handleCommand(message);
      } catch (error) {
        return normalizeMessageError(error);
      }
    }

    function setupActionEntry() {
      const sidePanel = chromeLike?.sidePanel;
      if (sidePanel?.setPanelBehavior) {
        try {
          const result = sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
          result?.catch?.(() => {});
          return;
        } catch (error) {
          // Fall through to action.onClicked when available.
        }
      }

      chromeLike?.action?.onClicked?.addListener?.((tab = {}) => {
        if (!sidePanel?.open || !tab.windowId) return;
        try {
          const result = sidePanel.open({ windowId: tab.windowId });
          result?.catch?.(() => {});
        } catch (error) {
          // Opening the side panel is best-effort; normal IPC remains available.
        }
      });
    }

    function register() {
      if (!automation && root.BHPAutomation?.createAutomation) {
        automation = root.BHPAutomation.createAutomation({
          settingsProvider: getSettings,
          storage: storageModule,
          filters: root.BHPFilters,
          messaging: root.BHPMessaging,
          aiRating: root.BHPAiRating?.createAiRating?.(),
          browserOps,
          reporter: (message) => {
            try {
              chromeLike?.runtime?.sendMessage?.(message);
            } catch (error) {
              // UI push is best-effort; state remains persisted.
            }
          }
        });
      }
      chromeLike?.runtime?.onMessage?.addListener?.((message, sender, sendResponse) => {
        dispatchMessage(message, sender).then(sendResponse);
        return true;
      });
      chromeLike?.alarms?.create?.('resumeTick', { periodInMinutes: 0.5 });
      setupActionEntry();
      netLogger?.register?.();
      chromeLike?.alarms?.onAlarm?.addListener?.((alarm) => handleResumeAlarm(alarm));
      return api;
    }

    const api = {
      autoCtx,
      dispatchMessage,
      getStatus,
      handleCommand,
      normalizeMessageError,
      register
    };

    return api;
  }

  const api = {
    createBackground,
    normalizeMessageError
  };

  root.BHPBackground = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (typeof module === 'undefined' && root.chrome?.runtime?.onMessage) {
    root.__BHPBackgroundApp = createBackground().register();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
