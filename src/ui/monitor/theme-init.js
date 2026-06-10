(function initTheme() {
  'use strict';

  try {
    const theme = localStorage.getItem('bhp.theme') || 'light';
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch (error) {
    // Theme is cosmetic; ignore storage errors.
  }
})();
