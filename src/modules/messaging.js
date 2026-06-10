(function initMessagingModule(root) {
  'use strict';

  function gradeOf(rating) {
    const value = typeof rating === 'string' ? rating : rating?.rating || rating?.grade;
    const grade = String(value || '').trim().toUpperCase();
    return ['A', 'B', 'C', 'D'].includes(grade) ? grade : '';
  }

  const TEMPLATE_ALIASES = {
    '候选人姓名': 'candidate_name',
    '岗位名称': 'job_title',
    '公司名称': 'company_name',
    '评级等级': 'rating',
    '评级摘要': 'rating_summary'
  };

  function cleanMessageText(text) {
    return String(text || '')
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function templateContext(data) {
    const ctx = { ...(data || {}) };
    if (ctx.name && !ctx.candidate_name) ctx.candidate_name = ctx.name;
    if (ctx.position && !ctx.job_title) ctx.job_title = ctx.position;
    if (ctx.grade && !ctx.rating) ctx.rating = ctx.grade;
    if (ctx.summary && !ctx.rating_summary) ctx.rating_summary = ctx.summary;
    return ctx;
  }

  function renderMessageTemplate(template, data) {
    const ctx = templateContext(data);
    const rendered = String(template || '').replace(/\{([^{}]+)\}/g, (_, rawKey) => {
      const key = rawKey.trim();
      const value = ctx[key] ?? ctx[TEMPLATE_ALIASES[key]];
      return value === undefined || value === null ? '' : String(value);
    });
    return cleanMessageText(rendered);
  }

  function decideMessageForRating(ratingResult, settings, candidate) {
    const cfg = settings || {};
    const messages = cfg.messages || {};
    const grade = gradeOf(ratingResult);
    const contactGrades = Array.isArray(cfg.contact_grades) ? cfg.contact_grades.map((item) => String(item).toUpperCase()) : ['A', 'B'];
    const passed = contactGrades.includes(grade);

    if (passed) {
      if (!messages.invite_on_pass_enabled) return { action: 'skip', reason: '未启用通过后自动回复' };
      const replyMode = messages.reply_mode === 'reply' ? 'reply' : 'wechat';
      const template = replyMode === 'reply' ? messages.contact_no_wechat : messages.contact;
      const message = renderMessageTemplate(template, { ...(candidate || {}), rating: grade, grade, rating_summary: ratingResult?.summary || '' });
      if (!message) return { action: 'skip', reason: '邀约话术为空' };
      return {
        action: replyMode === 'reply' ? 'reply' : 'contact',
        message,
        shouldExchangeWechat: replyMode !== 'reply' && messages.exchange_wechat_enabled !== false
      };
    }

    if (!messages.thank_on_fail_enabled) return { action: 'skip', reason: '未启用感谢话术' };
    const thank = renderMessageTemplate(messages.thank, { ...(candidate || {}), rating: grade, grade, rating_summary: ratingResult?.summary || ratingResult?.risk || '' });
    if (!thank) return { action: 'skip', reason: '感谢话术为空' };
    return { action: 'thank', message: thank, shouldExchangeWechat: false };
  }

  function decideMessageForBusinessFailure(result, settings) {
    const messages = settings?.messages || {};
    if (!messages.thank_on_fail_enabled) return { action: 'skip', reason: '未启用感谢话术' };
    const candidate = result?.candidate || {};
    const message = renderMessageTemplate(messages.thank, {
      ...candidate,
      rating: gradeOf(result?.rating),
      rating_summary: result?.summary || result?.reason || ''
    });
    if (!message) return { action: 'skip', reason: '感谢话术为空' };
    return { action: 'thank', message, shouldExchangeWechat: false };
  }

  async function sendChatMessage(message) {
    if (!message) return false;
    const ops = root.BHPBrowserOps;
    if (!ops?.cmdEvaluateInMainWorld) throw new Error('browser ops unavailable');
    return ops.cmdEvaluateInMainWorld('send_chat_message', { message });
  }

  const api = {
    decideMessageForRating,
    decideMessageForBusinessFailure,
    gradeOf,
    cleanMessageText,
    renderMessageTemplate,
    sendChatMessage
  };

  root.BHPMessaging = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
