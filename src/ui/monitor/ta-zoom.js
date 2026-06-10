(function initTextareaZoom() {
  'use strict';

  function setup() {
    const backdrop = document.getElementById('ta-zoom-backdrop');
    const title = document.getElementById('ta-zoom-title');
    const modalText = document.getElementById('ta-zoom-textarea');
    const close = document.getElementById('ta-zoom-close');
    if (!backdrop || !modalText) return;

    let source = null;
    const open = (textarea) => {
      source = textarea;
      if (title) title.textContent = textarea.closest('.field')?.querySelector('label')?.textContent || '编辑';
      modalText.value = textarea.value;
      backdrop.setAttribute('aria-hidden', 'false');
      backdrop.classList.add('visible');
      modalText.focus();
    };
    const hide = () => {
      if (source) source.value = modalText.value;
      backdrop.setAttribute('aria-hidden', 'true');
      backdrop.classList.remove('visible');
      source = null;
    };

    document.querySelectorAll('textarea').forEach((textarea) => {
      textarea.addEventListener('dblclick', () => open(textarea));
    });
    close?.addEventListener('click', hide);
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) hide();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && backdrop.classList.contains('visible')) hide();
    });
  }

  document.addEventListener('DOMContentLoaded', setup);
})();
