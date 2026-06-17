(function initNetLoggerModule(root) {
  'use strict';

  const STORAGE_KEY = '__bhpNetLog';
  const BODY_MAX = 1000;

  function clock(ts) {
    const d = new Date(ts || Date.now());
    return d.toISOString().slice(11, 23);
  }

  function headersToObject(headers = []) {
    const out = {};
    for (const header of headers || []) {
      if (header?.name) out[header.name.toLowerCase()] = header.value || '';
    }
    return out;
  }

  function redactSensitive(text) {
    return String(text || '')
      .replace(/1[3-9]\d{9}/g, '[phone]')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
      .replace(/(token|authorization|cookie|apikey|api_key)["'=:\s]+[^&\s",}]+/gi, '$1=[redacted]')
      .slice(0, BODY_MAX);
  }

  function extractRequestBody(details) {
    const body = details?.requestBody;
    if (!body) return '';
    if (body.formData) return redactSensitive(JSON.stringify(body.formData));
    if (Array.isArray(body.raw)) {
      return redactSensitive(body.raw.map((part) => {
        if (!part.bytes) return '';
        try {
          return new TextDecoder().decode(part.bytes);
        } catch (error) {
          return '';
        }
      }).join('\n'));
    }
    return '';
  }

  function isZhipinUrl(url) {
    return /:\/\/([^/]+\.)?zhipin\.com\//.test(String(url || ''));
  }

  function isLogout(entry) {
    if (entry.status === 401 || entry.status === 403) return true;
    if ((entry.status === 302 || entry.status === 303) && /login/i.test(entry.resHeaders?.location || '')) return true;
    return false;
  }

  function createNetLogger(options = {}) {
    const maxEntries = options.maxEntries || 150;
    const debugBodies = Boolean(options.debugBodies);
    const chromeLike = options.chrome || root.chrome;
    const onLogout = typeof options.onLogout === 'function' ? options.onLogout : null;
    const pending = new Map();
    const entries = [];
    let restorePromise = null;

    function push(entry) {
      entries.push(entry);
      while (entries.length > maxEntries) entries.shift();
      return entry;
    }

    function onBeforeRequest(details) {
      if (!isZhipinUrl(details?.url)) return;
      const entry = {
        id: details.requestId,
        url: String(details.url || '').slice(0, 220),
        method: details.method || 'GET',
        ts: clock(details.timeStamp),
        startedAt: details.timeStamp || Date.now()
      };
      if (debugBodies) {
        const reqBody = extractRequestBody(details);
        if (reqBody) entry.reqBody = reqBody;
      }
      pending.set(details.requestId, entry);
    }

    function finish(details, statusCode) {
      if (!isZhipinUrl(details?.url)) return;
      const base = pending.get(details.requestId) || {
        id: details.requestId,
        url: String(details.url || '').slice(0, 220),
        method: details.method || 'GET',
        ts: clock(details.timeStamp),
        startedAt: details.timeStamp || Date.now()
      };
      pending.delete(details.requestId);
      const entry = {
        ...base,
        status: statusCode,
        duration: Math.max(0, Math.round((details.timeStamp || Date.now()) - base.startedAt)),
        resHeaders: headersToObject(details.responseHeaders)
      };
      delete entry.startedAt;
      if (isLogout(entry)) entry._logout = true;
      push(entry);
      if (entry._logout) {
        persist('logout')?.catch?.(() => {});
        if (onLogout) {
          try {
            Promise.resolve(onLogout(entry)).catch(() => {});
          } catch (error) {
            // Logout notification is best-effort; the network snapshot is still kept.
          }
        }
      }
      return entry;
    }

    function onCompleted(details) {
      return finish(details, details.statusCode);
    }

    function onBeforeRedirect(details) {
      return finish(details, details.statusCode || 302);
    }

    function snapshot() {
      return entries.slice();
    }

    function clear() {
      entries.length = 0;
      pending.clear();
      return 'cleared';
    }

    async function persist(reason = 'PERIODIC') {
      if (!chromeLike?.storage?.local) return null;
      const payload = {
        reason,
        time: new Date().toISOString(),
        entries: entries.slice(-100)
      };
      await chromeLike.storage.local.set({ [STORAGE_KEY]: payload });
      return payload;
    }

    async function restore() {
      if (!chromeLike?.storage?.local) return snapshot();
      if (!restorePromise) {
        restorePromise = (async () => {
          const data = await chromeLike.storage.local.get(STORAGE_KEY);
          const savedEntries = Array.isArray(data?.[STORAGE_KEY]?.entries) ? data[STORAGE_KEY].entries : [];
          if (!savedEntries.length) return snapshot();
          const seen = new Set(entries.map((entry) => `${entry.id || ''}|${entry.ts || ''}|${entry.status || ''}|${entry.url || ''}`));
          for (const entry of savedEntries) {
            if (!entry || typeof entry !== 'object') continue;
            const key = `${entry.id || ''}|${entry.ts || ''}|${entry.status || ''}|${entry.url || ''}`;
            if (seen.has(key)) continue;
            seen.add(key);
            entries.push({ ...entry });
          }
          while (entries.length > maxEntries) entries.shift();
          return snapshot();
        })().catch(() => snapshot());
      }
      return restorePromise;
    }

    function register() {
      const filter = { urls: ['*://*.zhipin.com/*'] };
      restore()?.catch?.(() => {});
      chromeLike?.webRequest?.onBeforeRequest?.addListener?.(onBeforeRequest, filter, ['requestBody']);
      chromeLike?.webRequest?.onCompleted?.addListener?.(onCompleted, filter, ['responseHeaders']);
      chromeLike?.webRequest?.onBeforeRedirect?.addListener?.(onBeforeRedirect, filter, ['responseHeaders']);
      return api;
    }

    const api = {
      clear,
      onBeforeRedirect,
      onBeforeRequest,
      onCompleted,
      persist,
      register,
      restore,
      snapshot
    };
    return api;
  }

  const api = {
    STORAGE_KEY,
    createNetLogger,
    isLogout,
    redactSensitive
  };

  root.BHPNetLogger = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
