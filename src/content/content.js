(function initBhpIsolatedBridge(root) {
  'use strict';

  function sendRuntimeMessage(message) {
    try {
      if (root.chrome?.runtime?.sendMessage) root.chrome.runtime.sendMessage(message);
    } catch (error) {
      // Content scripts must not break the page if extension messaging is unavailable.
    }
  }

  root.addEventListener('message', (event) => {
    if (event.source !== root || !event.data || event.data.source !== 'BHP_MAIN_WORLD') return;
    if (event.data.type === 'BHP_MAIN_READY') {
      sendRuntimeMessage({
        type: 'BHP_BRIDGE_READY',
        payload: {
          url: root.location.href,
          title: document.title,
          readyState: document.readyState
        }
      });
    }
  });

  sendRuntimeMessage({
    type: 'PAGE_STATUS',
    payload: {
      url: root.location.href,
      title: document.title,
      readyState: document.readyState
    }
  });
})(window);
