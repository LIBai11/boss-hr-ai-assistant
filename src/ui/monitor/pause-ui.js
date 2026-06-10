(function initPauseUi(root) {
  'use strict';

  root.BHPPauseUi = {
    show(text) {
      const banner = document.getElementById('pause-banner');
      const label = document.getElementById('pause-banner-text');
      if (label) label.textContent = text || '已暂停';
      if (banner) banner.style.display = '';
    },
    hide() {
      const banner = document.getElementById('pause-banner');
      if (banner) banner.style.display = 'none';
    }
  };
})(window);
