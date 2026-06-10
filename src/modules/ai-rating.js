(function initAiRatingModule(root) {
  'use strict';

  function normalizeRating(result, source, extra = {}) {
    if (!result) throw new Error('AI 评级结果为空');
    const rating = String(result.rating || result.grade || '').trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(rating)) throw new Error('AI 评级结果缺少 A/B/C/D rating');
    return {
      rating,
      summary: String(result.summary || result.reason || '').trim(),
      risk: String(result.risk || result.weakness || '').trim(),
      source,
      ...extra
    };
  }

  function createAiRating(options = {}) {
    const settingsProvider = options.settingsProvider || root.BHPSettings?.getSettings;
    const byoProvider = options.byoProvider || root.BHPByoProvider;

    async function getSettings() {
      if (typeof settingsProvider !== 'function') return root.BHPSettings?.mergeSettings?.({}) || {};
      return settingsProvider();
    }

    async function analyzeResume(resumeData, promptOverride) {
      const settings = await getSettings();
      const prompt = promptOverride || settings.rating_prompt || '';
      const byo = settings.byo || {};

      if (!byo.enabled || !byo.url || !byo.key || !byo.model) {
        const error = new Error('请先配置自定义 AI（Base URL / API Key / Model）');
        error.code = 'byo_not_configured';
        throw error;
      }

      try {
        if (!byoProvider?.analyze) throw new Error('自定义 AI 提供器不可用');
        return normalizeRating(await byoProvider.analyze(byo, resumeData, prompt), 'byo');
      } catch (error) {
        error.code = error.code || 'byo_failed';
        throw error;
      }
    }

    return {
      analyzeResume,
      normalizeRating
    };
  }

  const api = {
    createAiRating,
    normalizeRating
  };

  root.BHPAiRating = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
