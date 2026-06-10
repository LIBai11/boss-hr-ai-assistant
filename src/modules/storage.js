(function initStorageModule(root) {
  'use strict';

  const DAILY_USAGE_KEY = 'dailyUsage';
  const RUN_STATE_KEY = 'runState';
  const RUN_HISTORY_KEY = 'runHistory';
  const PAUSE_STATE_KEY = 'autoPauseState';
  const PAUSE_TTL_MS = 15 * 60 * 1000;
  const DEFAULT_DAILY_USAGE = {
    date: '',
    follow_runs: 0,
    proactive_runs: 0,
    proactive_resume_views: 0
  };

  function dateKeyInTimeZone(date = new Date(), timeZone = 'Asia/Shanghai') {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    const pick = (type) => parts.find((part) => part.type === type)?.value;
    return `${pick('year')}-${pick('month')}-${pick('day')}`;
  }

  function numericCounter(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }

  function emptyDailyUsage(now = new Date()) {
    return {
      ...DEFAULT_DAILY_USAGE,
      date: dateKeyInTimeZone(now)
    };
  }

  function normalizeDailyUsage(value, now = new Date()) {
    const today = dateKeyInTimeZone(now);
    if (!value || value.date !== today) return emptyDailyUsage(now);
    return {
      date: today,
      follow_runs: numericCounter(value.follow_runs),
      proactive_runs: numericCounter(value.proactive_runs),
      proactive_resume_views: numericCounter(value.proactive_resume_views)
    };
  }

  function canOpenProactiveResume() {
    return true;
  }

  async function storageGet(key) {
    if (!root.chrome?.storage?.local) return {};
    return root.chrome.storage.local.get(key);
  }

  async function storageSet(value) {
    if (root.chrome?.storage?.local) await root.chrome.storage.local.set(value);
  }

  async function getDailyUsage(now = new Date()) {
    const data = await storageGet(DAILY_USAGE_KEY);
    return normalizeDailyUsage(data[DAILY_USAGE_KEY], now);
  }

  async function saveDailyUsage(usage, now = new Date()) {
    const normalized = normalizeDailyUsage(usage, now);
    await storageSet({ [DAILY_USAGE_KEY]: normalized });
    return normalized;
  }

  async function incrementDailyUsage(field, amount = 1, now = new Date()) {
    const current = await getDailyUsage(now);
    if (!(field in DEFAULT_DAILY_USAGE) || field === 'date') {
      throw new Error(`Unknown daily usage field: ${field}`);
    }
    current[field] = numericCounter(current[field]) + numericCounter(amount || 1);
    await storageSet({ [DAILY_USAGE_KEY]: current });
    return current;
  }

  async function getRunState() {
    const data = await storageGet(RUN_STATE_KEY);
    return data[RUN_STATE_KEY] || null;
  }

  async function saveRunState(runState) {
    await storageSet({ [RUN_STATE_KEY]: runState || null });
    return runState || null;
  }

  async function getPauseState(now = new Date()) {
    const data = await storageGet(PAUSE_STATE_KEY);
    const pauseState = data[PAUSE_STATE_KEY] || null;
    if (!pauseState || !pauseState.ts) return null;
    const expiresAt = Number(pauseState.ts) + Number(pauseState.ttlMs || PAUSE_TTL_MS);
    if (Number.isFinite(expiresAt) && expiresAt <= now.getTime()) {
      await clearPauseState();
      return null;
    }
    return pauseState;
  }

  async function savePauseState(pauseState) {
    const state = {
      ts: Date.now(),
      ttlMs: PAUSE_TTL_MS,
      ...(pauseState || {})
    };
    await storageSet({ [PAUSE_STATE_KEY]: state });
    return state;
  }

  async function clearPauseState() {
    if (root.chrome?.storage?.local?.remove) await root.chrome.storage.local.remove(PAUSE_STATE_KEY);
    else await storageSet({ [PAUSE_STATE_KEY]: null });
    return true;
  }

  async function appendRunHistory(entry, now = new Date()) {
    const data = await storageGet(RUN_HISTORY_KEY);
    const history = data[RUN_HISTORY_KEY] && typeof data[RUN_HISTORY_KEY] === 'object' ? data[RUN_HISTORY_KEY] : {};
    const key = dateKeyInTimeZone(now);
    const bucket = Array.isArray(history[key]) ? history[key] : [];
    bucket.push({ time: new Date(now).toISOString(), ...(entry || {}) });
    history[key] = bucket.slice(-200);
    await storageSet({ [RUN_HISTORY_KEY]: history });
    return history;
  }

  const api = {
    DAILY_USAGE_KEY,
    PAUSE_STATE_KEY,
    PAUSE_TTL_MS,
    appendRunHistory,
    canOpenProactiveResume,
    clearPauseState,
    dateKeyInTimeZone,
    emptyDailyUsage,
    getDailyUsage,
    getPauseState,
    getRunState,
    incrementDailyUsage,
    normalizeDailyUsage,
    savePauseState,
    saveDailyUsage,
    saveRunState
  };

  root.BHPStorage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
