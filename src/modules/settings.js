(function initSettingsModule(root) {
  'use strict';

  const DEFAULT_SETTINGS = {
    run_time_limit_minutes: 15,
    age_max: 30,
    school_filter_enabled: false,
    schools: [],
    company_filter_enabled: false,
    companies: [],
    proactive_screening: {
      age_max: 30,
      school_filter_enabled: false,
      schools: [],
      company_filter_enabled: false,
      companies: [],
      followup_msg: '',
      page_filters: {
        intention: [],
        edu: [],
        salary: '',
        experience: [],
        callPhone: []
      },
      vip_filters: {
        activation: '',
        gender: '',
        vip_distance: '',
        switchJobFrequency: '',
        recentNotView: [],
        exchangeResumeWithColleague: [],
        school: [],
        major: [],
        keyword1: [],
        callPhone: []
      },
      vip_dynamic_options: {
        major: [],
        keyword1: [],
        updated_at: ''
      }
    },
    messages: {
      greeting: '你好，看到你的简历，觉得你挺适合我们公司的一个岗位，方便了解一下吗？',
      contact: '',
      contact_no_wechat: '',
      thank: '感谢你的关注，我们已认真看过你的简历，目前你的背景和我们当前的岗位定位有一些差异，祝你早日找到心仪的工作。',
      job_closed: '不好意思，这个岗位目前已经关闭了，无法继续沟通，祝你早日找到心仪的工作。',
      thank_on_fail_enabled: false,
      invite_on_pass_enabled: false,
      reply_mode: 'wechat',
      exchange_wechat_enabled: true
    },
    contact_grades: ['A', 'B'],
    rating_prompt: '请分析这份简历并给出评级。严格按 JSON 输出：{"rating":"A/B/C/D","summary":"一句话优势","risk":"一句话风险"}',
    byo: {
      enabled: true,
      url: '',
      key: '',
      model: '',
      protocol: 'auto',
      multimodal: false,
      last_test: null,
      advanced: {
        force_protocol: 'auto',
        headers: '',
        pdf_mode: 'auto',
        skip_probe: false,
        pdf_fail_models: [],
        vision_fail_models: []
      }
    },
    auto_download_log: false,
    debug_enabled: false
  };

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function deepClone(value) {
    if (Array.isArray(value)) return value.map(deepClone);
    if (isPlainObject(value)) {
      const out = {};
      for (const [key, item] of Object.entries(value)) out[key] = deepClone(item);
      return out;
    }
    return value;
  }

  function deepMerge(base, patch) {
    const out = deepClone(base);
    if (!isPlainObject(patch)) return out;
    for (const [key, value] of Object.entries(patch)) {
      if (isPlainObject(value) && isPlainObject(out[key])) out[key] = deepMerge(out[key], value);
      else out[key] = deepClone(value);
    }
    return out;
  }

  function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
  }

  function listFromValue(value) {
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    if (typeof value === 'string') {
      return value.split(/\r?\n|,|，/).map((item) => item.trim()).filter(Boolean);
    }
    return [];
  }

  function normalizeGrades(value) {
    const grades = listFromValue(value).map((item) => item.toUpperCase()).filter((item) => ['A', 'B', 'C', 'D'].includes(item));
    return grades.length ? Array.from(new Set(grades)) : ['A', 'B'];
  }

  function normalizeSettings(input) {
    const out = deepMerge(DEFAULT_SETTINGS, input);

    out.run_time_limit_minutes = clampNumber(out.run_time_limit_minutes, 8, 15, DEFAULT_SETTINGS.run_time_limit_minutes);
    out.age_max = clampNumber(out.age_max, 18, 60, DEFAULT_SETTINGS.age_max);
    out.schools = listFromValue(out.schools);
    out.companies = listFromValue(out.companies);
    out.contact_grades = normalizeGrades(out.contact_grades);

    const pro = out.proactive_screening;
    pro.age_max = clampNumber(pro.age_max, 18, 60, DEFAULT_SETTINGS.proactive_screening.age_max);
    pro.schools = listFromValue(pro.schools);
    pro.companies = listFromValue(pro.companies);
    pro.followup_msg = String(pro.followup_msg || '');
    pro.page_filters.intention = listFromValue(pro.page_filters.intention);
    pro.page_filters.edu = listFromValue(pro.page_filters.edu);
    pro.page_filters.salary = String(pro.page_filters.salary || '');
    pro.page_filters.experience = listFromValue(pro.page_filters.experience);
    pro.page_filters.callPhone = listFromValue(pro.page_filters.callPhone);

    for (const key of ['recentNotView', 'exchangeResumeWithColleague', 'school', 'major', 'keyword1', 'callPhone']) {
      pro.vip_filters[key] = listFromValue(pro.vip_filters[key]);
    }
    for (const key of ['activation', 'gender', 'vip_distance', 'switchJobFrequency']) {
      pro.vip_filters[key] = String(pro.vip_filters[key] || '');
    }
    pro.vip_dynamic_options.major = listFromValue(pro.vip_dynamic_options.major);
    pro.vip_dynamic_options.keyword1 = listFromValue(pro.vip_dynamic_options.keyword1);

    out.messages.reply_mode = out.messages.reply_mode === 'reply' ? 'reply' : 'wechat';
    out.byo.enabled = true;
    out.byo.protocol = ['auto', 'openai', 'anthropic', 'gemini'].includes(out.byo.protocol) ? out.byo.protocol : 'auto';
    const byoAdvanced = out.byo.advanced || {};
    out.byo.advanced = {
      force_protocol: ['auto', 'openai', 'anthropic', 'gemini'].includes(byoAdvanced.force_protocol)
        ? byoAdvanced.force_protocol
        : 'auto',
      headers: String(byoAdvanced.headers || ''),
      pdf_mode: ['auto', 'inline', 'image'].includes(byoAdvanced.pdf_mode)
        ? byoAdvanced.pdf_mode
        : 'auto',
      skip_probe: Boolean(byoAdvanced.skip_probe),
      pdf_fail_models: listFromValue(byoAdvanced.pdf_fail_models),
      vision_fail_models: listFromValue(byoAdvanced.vision_fail_models)
    };

    return out;
  }

  function mergeSettings(input) {
    return normalizeSettings(input || {});
  }

  async function getSettings() {
    if (!root.chrome?.storage?.local) return mergeSettings();
    const data = await root.chrome.storage.local.get('settings');
    return mergeSettings(data.settings || {});
  }

  async function saveSettings(nextSettings) {
    const settings = mergeSettings(nextSettings || {});
    if (root.chrome?.storage?.local) await root.chrome.storage.local.set({ settings });
    return settings;
  }

  async function patchSettings(partial) {
    const current = await getSettings();
    return saveSettings(deepMerge(current, partial || {}));
  }

  const api = {
    DEFAULT_SETTINGS,
    clampNumber,
    deepMerge,
    getSettings,
    listFromValue,
    mergeSettings,
    normalizeSettings,
    patchSettings,
    saveSettings
  };

  root.BHPSettings = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
