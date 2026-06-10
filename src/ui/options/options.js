(function initOptionsUi(root) {
  'use strict';

  const api = root.BHPPageApi;
  const $ = (id) => document.getElementById(id);

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text || '';
  }

  function setValue(id, value) {
    const el = $(id);
    if (el && value !== undefined && value !== null) el.value = value;
  }

  function show(id, visible, display = '') {
    const el = $(id);
    if (el) el.style.display = visible ? display : 'none';
  }

  function syncRunLimitLabel() {
    const value = Number($('run_time_limit_minutes')?.value || 15);
    setText('run_time_limit_minutes_value', `${value} 分钟`);
  }

  function lines(value) {
    return Array.isArray(value) ? value.join('\n') : String(value || '');
  }

  function setChecked(id, checked) {
    const el = $(id);
    if (el) el.checked = Boolean(checked);
  }

  function all(selector) {
    return Array.from(document.querySelectorAll?.(selector) || []);
  }

  function checkedValues(selector) {
    return all(selector)
      .filter((el) => el.checked)
      .map((el) => String(el.value || '').trim())
      .filter(Boolean);
  }

  function setCheckedValues(selector, values) {
    const selected = new Set((Array.isArray(values) ? values : []).map((item) => String(item)));
    for (const el of all(selector)) el.checked = selected.has(String(el.value));
  }

  function checkedValuesByDataKey(selector) {
    const out = {};
    for (const el of all(selector)) {
      if (!el.checked) continue;
      const key = el.getAttribute?.('data-key');
      const value = String(el.value || '').trim();
      if (!key || !value) continue;
      if (!out[key]) out[key] = [];
      out[key].push(value);
    }
    return out;
  }

  function setCheckedValuesByDataKey(selector, valuesByKey = {}) {
    for (const el of all(selector)) {
      const key = el.getAttribute?.('data-key');
      const selected = Array.isArray(valuesByKey[key]) ? valuesByKey[key].map((item) => String(item)) : [];
      el.checked = selected.includes(String(el.value));
    }
  }

  function valuesByDataKey(selector) {
    const out = {};
    for (const el of all(selector)) {
      const key = el.getAttribute?.('data-key');
      const value = String(el.value || '').trim();
      if (key && value) out[key] = value;
    }
    return out;
  }

  function setValuesByDataKey(selector, valuesByKey = {}) {
    for (const el of all(selector)) {
      const key = el.getAttribute?.('data-key');
      if (key && valuesByKey[key] !== undefined) el.value = valuesByKey[key];
    }
  }

  function radioValue(name, fallback = 'auto') {
    const el = document.querySelector?.(`input[name="${name}"]:checked`);
    return el?.value || fallback;
  }

  function setRadioValue(name, value) {
    for (const el of all(`input[name="${name}"]`)) {
      el.checked = String(el.value) === String(value);
    }
  }

  function loadSettingsToForm(settings) {
    const pro = settings.proactive_screening || {};
    const pageFilters = pro.page_filters || {};
    const vipFilters = pro.vip_filters || {};
    const messages = settings.messages || {};
    const byo = settings.byo || {};
    const byoAdvanced = byo.advanced || {};

    setValue('run_time_limit_minutes', settings.run_time_limit_minutes ?? 15);
    syncRunLimitLabel();
    setValue('age_max', settings.age_max);
    setChecked('school_enabled', settings.school_filter_enabled);
    setValue('schools', lines(settings.schools));
    setChecked('company_enabled', settings.company_filter_enabled);
    setValue('companies', lines(settings.companies));

    setValue('pro_age_max', pro.age_max ?? 30);
    setChecked('pro_school_enabled', pro.school_filter_enabled);
    setValue('pro_schools', lines(pro.schools));
    setChecked('pro_company_enabled', pro.company_filter_enabled);
    setValue('pro_companies', lines(pro.companies));
    setValue('pro_followup_msg', pro.followup_msg || '');
    setCheckedValues('.pf-edu-cb', pageFilters.edu || []);
    setCheckedValues('.pf-intention-cb', pageFilters.intention || []);
    setValue('pf_salary', pageFilters.salary || '');
    setCheckedValues('.pf-exp-cb', pageFilters.experience || []);
    setCheckedValuesByDataKey('.bhp-vipf-cb', {
      ...vipFilters,
      callPhone: pageFilters.callPhone || vipFilters.callPhone || []
    });
    setValuesByDataKey('.bhp-vipf-radio', vipFilters);

    setValue('msg_greeting', messages.greeting || '');
    setValue('msg_thank', messages.thank || '');
    setValue('msg_contact', messages.contact || '');
    setValue('msg_contact_no_wechat', messages.contact_no_wechat || '');
    setValue('msg_job_closed', messages.job_closed || '');
    setChecked('thank_on_fail_enabled', messages.thank_on_fail_enabled);
    setChecked('invite_on_pass_enabled', messages.invite_on_pass_enabled);
    setChecked('reply_mode_reply', messages.reply_mode === 'reply');
    setChecked('reply_mode_wechat', messages.reply_mode !== 'reply');
    setRadioValue('reply_mode', messages.reply_mode || 'wechat');
    setChecked('exchange_wechat_enabled', messages.exchange_wechat_enabled !== false);
    setCheckedValues('.grade-cb', settings.contact_grades || ['A', 'B']);
    setValue('rating_prompt', settings.rating_prompt || '');

    setValue('byo_url', byo.url || '');
    setValue('byo_key', byo.key || '');
    setValue('byo_model', byo.model || '');
    setValue('byo_headers', byoAdvanced.headers || '');
    setRadioValue('byo_force_protocol', byoAdvanced.force_protocol || 'auto');
    setRadioValue('byo_pdf_mode', byoAdvanced.pdf_mode || 'auto');
    setChecked('byo_skip_probe', byoAdvanced.skip_probe);
  }

  function collectSettings() {
    const pageCallPhoneAndVipChecks = checkedValuesByDataKey('.bhp-vipf-cb');
    const vipRadioValues = valuesByDataKey('.bhp-vipf-radio');
    return {
      run_time_limit_minutes: Number($('run_time_limit_minutes')?.value || 15),
      age_max: Number($('age_max')?.value || 30),
      school_filter_enabled: Boolean($('school_enabled')?.checked),
      schools: $('schools')?.value || '',
      company_filter_enabled: Boolean($('company_enabled')?.checked),
      companies: $('companies')?.value || '',
      proactive_screening: {
        age_max: Number($('pro_age_max')?.value || 30),
        school_filter_enabled: Boolean($('pro_school_enabled')?.checked),
        schools: $('pro_schools')?.value || '',
        company_filter_enabled: Boolean($('pro_company_enabled')?.checked),
        companies: $('pro_companies')?.value || '',
        followup_msg: $('pro_followup_msg')?.value || '',
        page_filters: {
          edu: checkedValues('.pf-edu-cb'),
          intention: checkedValues('.pf-intention-cb'),
          salary: $('pf_salary')?.value || '',
          experience: checkedValues('.pf-exp-cb'),
          callPhone: pageCallPhoneAndVipChecks.callPhone || []
        },
        vip_filters: {
          activation: vipRadioValues.activation || '',
          gender: vipRadioValues.gender || '',
          vip_distance: vipRadioValues.vip_distance || '',
          switchJobFrequency: vipRadioValues.switchJobFrequency || '',
          recentNotView: pageCallPhoneAndVipChecks.recentNotView || [],
          exchangeResumeWithColleague: pageCallPhoneAndVipChecks.exchangeResumeWithColleague || [],
          school: pageCallPhoneAndVipChecks.school || [],
          major: pageCallPhoneAndVipChecks.major || [],
          keyword1: pageCallPhoneAndVipChecks.keyword1 || [],
          callPhone: pageCallPhoneAndVipChecks.callPhone || []
        }
      },
      messages: {
        greeting: $('msg_greeting')?.value || '',
        thank: $('msg_thank')?.value || '',
        contact: $('msg_contact')?.value || '',
        contact_no_wechat: $('msg_contact_no_wechat')?.value || '',
        job_closed: $('msg_job_closed')?.value || '',
        thank_on_fail_enabled: Boolean($('thank_on_fail_enabled')?.checked),
        invite_on_pass_enabled: Boolean($('invite_on_pass_enabled')?.checked),
        reply_mode: radioValue('reply_mode', $('reply_mode_reply')?.checked ? 'reply' : 'wechat'),
        exchange_wechat_enabled: Boolean($('exchange_wechat_enabled')?.checked)
      },
      contact_grades: checkedValues('.grade-cb'),
      rating_prompt: $('rating_prompt')?.value || '',
      byo: {
        enabled: true,
        url: $('byo_url')?.value || '',
        key: $('byo_key')?.value || '',
        model: $('byo_model')?.value || '',
        advanced: {
          force_protocol: radioValue('byo_force_protocol', 'auto'),
          headers: $('byo_headers')?.value || '',
          pdf_mode: radioValue('byo_pdf_mode', 'auto'),
          skip_probe: Boolean($('byo_skip_probe')?.checked)
        }
      }
    };
  }

  async function refresh() {
    try {
      const settings = await api.getSettings();
      show('settings-area', true);
      loadSettingsToForm(settings);
    } catch (error) {
      show('settings-area', true);
    }
  }

  function bind() {
    $('run_time_limit_minutes')?.addEventListener('input', syncRunLimitLabel);
    $('run_time_limit_minutes')?.addEventListener('change', syncRunLimitLabel);
    $('btn-save')?.addEventListener('click', async () => {
      const toast = $('toast');
      try {
        await api.saveSettings(collectSettings());
        if (toast) {
          toast.textContent = '已保存';
          toast.classList.add('show');
          setTimeout(() => toast.classList.remove('show'), 1600);
        }
      } catch (error) {
        if (toast) {
          toast.textContent = error.message;
          toast.classList.add('show');
        }
      }
    });
    $('byo_test_btn')?.addEventListener('click', async () => {
      const result = $('byo_test_result');
      const detail = $('byo_test_detail');
      try {
        const url = $('byo_url')?.value || '';
        await api.requestByoPermission(url);
        const probe = await api.testByo({
          url,
          key: $('byo_key')?.value || '',
          model: $('byo_model')?.value || ''
        });
        if (result) {
          result.style.display = '';
          result.textContent = probe.success ? '连接成功' : '连接失败';
        }
        if (detail) detail.textContent = probe.detail || '';
      } catch (error) {
        if (result) {
          result.style.display = '';
          result.textContent = '连接失败';
        }
        if (detail) detail.textContent = error.message;
      }
    });
    $('byo_adv_toggle')?.addEventListener('click', () => {
      const advanced = $('byo_advanced');
      if (advanced) advanced.classList.toggle('show');
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bind();
    refresh();
  });
})(window);
