(function initBhpIsolatedBridge(root) {
  'use strict';

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function detectBossStatus() {
    const href = String(root.location?.href || '');
    if (!/zhipin\.com/i.test(href)) return null;
    const title = String(document.title || '');
    if (/login|logout/i.test(href) || /登录|注册/.test(title)) {
      return {
        loggedIn: false,
        user: '',
        vip: false,
        newGreetingCount: 0,
        lastCheckedAt: new Date().toISOString()
      };
    }
    const selectors = [
      'a[ka="header-username"] .label-text',
      '.nav-logout .user-name',
      '.user-info .user-name',
      '[class*="user-name"]',
      'a[ka="menu_dropdown_signout"]'
    ];
    let user = '';
    for (const selector of selectors) {
      const text = normalizeText(document.querySelector(selector)?.textContent);
      if (text) {
        user = text;
        break;
      }
    }
    if (!user) return null;
    let vip = Boolean(document.querySelector('i.icon-vip, img.vip-icon-v2'));
    if (!vip) {
      for (const frame of Array.from(document.querySelectorAll('iframe') || [])) {
        try {
          if (frame.contentDocument?.querySelector?.('i.icon-vip, img.vip-icon-v2')) {
            vip = true;
            break;
          }
        } catch (error) {
          // Cross-origin iframes are expected.
        }
      }
    }
    return {
      loggedIn: true,
      user,
      vip,
      lastCheckedAt: new Date().toISOString()
    };
  }

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
      readyState: document.readyState,
      bossStatus: detectBossStatus()
    }
  });
})(window);
