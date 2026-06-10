(function initBhpPageApi(root) {
  'use strict';

  function normalizeRuntimeError(error) {
    return error?.message || String(error || 'Unknown runtime error');
  }

  function send(type, payload = {}) {
    return new Promise((resolve, reject) => {
      if (!root.chrome?.runtime?.sendMessage) {
        reject(new Error('chrome.runtime.sendMessage 不可用'));
        return;
      }
      try {
        root.chrome.runtime.sendMessage({ type, payload }, (response) => {
          const runtimeError = root.chrome.runtime.lastError;
          if (runtimeError) {
            reject(new Error(normalizeRuntimeError(runtimeError)));
            return;
          }
          if (response?.ok === false && response.error) {
            reject(new Error(response.error.message || '扩展命令执行失败'));
            return;
          }
          resolve(response);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function on(type, handler) {
    if (!root.chrome?.runtime?.onMessage || typeof handler !== 'function') return () => {};
    const listener = (message) => {
      if (message?.type === type) handler(message.payload, message);
    };
    root.chrome.runtime.onMessage.addListener(listener);
    return () => {
      try {
        root.chrome.runtime.onMessage.removeListener(listener);
      } catch (error) {
        // Best-effort cleanup for extension pages.
      }
    };
  }

  const api = {
    byType: send,
    getSettings: () => send('GET_SETTINGS'),
    getStatus: () => send('GET_STATUS'),
    generateMessageTemplates: (settings) => send('BYO_GENERATE_TEMPLATES', { settings }),
    getPauseState: () => send('GET_PAUSE_STATE'),
    on,
    requestByoPermission: (url) => send('REQUEST_BYO_PERMISSION', { url }),
    resumeAuto: () => send('RESUME_AUTO'),
    saveSettings: (settings) => send('SAVE_SETTINGS', { settings }),
    send,
    startAuto: (mode, subMode) => send('START_AUTO', { mode, subMode }),
    stopAuto: () => send('STOP_AUTO'),
    clearPauseState: () => send('CLEAR_PAUSE_STATE'),
    testByo: (config) => send('BYO_TEST', config)
  };

  root.BHPPageApi = api;
})(window);
