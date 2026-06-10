(function initBhpMainWorldBridge(root) {
  'use strict';

  const SOURCE = 'BHP_MAIN_WORLD';
  const REQUEST = 'BHP_PAGE_API_REQUEST';
  const RESPONSE = 'BHP_PAGE_API_RESPONSE';

  async function pageFetch(payload = {}) {
    const path = String(payload.path || '');
    if (!path.startsWith('/')) throw new Error('PAGE_API path must start with /');
    const init = {
      method: payload.method || 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(payload.headers || {})
      }
    };
    if (payload.body != null) init.body = JSON.stringify(payload.body);
    const response = await fetch(path, init);
    const text = await response.text();
    let data = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      // Keep plain text responses as-is.
    }
    return {
      ok: response.ok,
      status: response.status,
      data
    };
  }

  root.BHPPageBridge = {
    fetch: pageFetch,
    ready: true
  };

  root.addEventListener('message', async (event) => {
    if (event.source !== root || event.data?.source !== SOURCE || event.data?.type !== REQUEST) return;
    const { requestId, payload } = event.data;
    try {
      const result = await pageFetch(payload);
      root.postMessage({ source: SOURCE, type: RESPONSE, requestId, result }, '*');
    } catch (error) {
      root.postMessage({
        source: SOURCE,
        type: RESPONSE,
        requestId,
        error: { message: error.message || String(error) }
      }, '*');
    }
  });

  root.postMessage({ source: SOURCE, type: 'BHP_MAIN_READY' }, '*');
})(window);
