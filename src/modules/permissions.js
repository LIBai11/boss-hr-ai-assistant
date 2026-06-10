(function initPermissionsModule(root) {
  'use strict';

  function byoPermissionFromUrl(rawUrl) {
    let url;
    try {
      url = new URL(String(rawUrl || '').trim());
    } catch (error) {
      throw new Error('自定义 AI Base URL 不是有效 URL');
    }

    if (url.protocol !== 'https:') {
      throw new Error('自定义 AI Base URL 必须使用 https');
    }

    const origin = url.origin;
    return {
      origin,
      pattern: `${origin}/*`
    };
  }

  function callPermissionApi(chromeLike, method, query) {
    return new Promise((resolve, reject) => {
      const permissionsApi = chromeLike?.permissions;
      const fn = permissionsApi?.[method];
      if (typeof fn !== 'function') {
        reject(new Error(`chrome.permissions.${method} 不可用`));
        return;
      }

      try {
        fn.call(permissionsApi, query, (result) => {
          const runtimeError = chromeLike?.runtime?.lastError;
          if (runtimeError) {
            reject(new Error(runtimeError.message || String(runtimeError)));
            return;
          }
          resolve(Boolean(result));
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async function hasByoPermission(chromeLike, rawUrl) {
    const permission = byoPermissionFromUrl(rawUrl);
    const granted = await callPermissionApi(chromeLike, 'contains', { origins: [permission.pattern] });
    return {
      granted,
      origin: permission.origin
    };
  }

  async function requestByoPermission(chromeLike, rawUrl) {
    const permission = byoPermissionFromUrl(rawUrl);
    const query = { origins: [permission.pattern] };
    const alreadyGranted = await callPermissionApi(chromeLike, 'contains', query);
    if (alreadyGranted) {
      return {
        granted: true,
        alreadyGranted: true,
        origin: permission.origin
      };
    }

    const granted = await callPermissionApi(chromeLike, 'request', query);
    return {
      granted,
      alreadyGranted: false,
      origin: permission.origin
    };
  }

  const api = {
    byoPermissionFromUrl,
    hasByoPermission,
    requestByoPermission
  };

  root.BHPPermissions = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
