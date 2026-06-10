const test = require('node:test');
const assert = require('node:assert/strict');

function createElement(id = '') {
  const classes = new Set();
  return {
    id,
    attributes: {},
    checked: false,
    children: [],
    className: '',
    style: {},
    textContent: '',
    value: '',
    addEventListener(type, handler) {
      this[`on${type}`] = handler;
    },
    getAttribute(name) {
      return this.attributes[name] || null;
    },
    classList: {
      add(name) {
        classes.add(name);
      },
      remove(name) {
        classes.delete(name);
      },
      toggle(name) {
        if (classes.has(name)) {
          classes.delete(name);
          return false;
        }
        classes.add(name);
        return true;
      },
      contains(name) {
        return classes.has(name);
      }
    }
  };
}

function setupOptionsHarness() {
  const elements = new Map();
  const classGroups = new Map();
  const ids = [
    'settings-area',
    'run_time_limit_minutes',
    'run_time_limit_minutes_value',
    'age_max',
    'school_enabled',
    'schools',
    'company_enabled',
    'companies',
    'pro_age_max',
    'pro_school_enabled',
    'pro_schools',
    'pro_company_enabled',
    'pro_companies',
    'pro_followup_msg',
    'pf_salary',
    'msg_greeting',
    'thank_on_fail_enabled',
    'msg_thank',
    'invite_on_pass_enabled',
    'reply_mode_wechat',
    'reply_mode_reply',
    'exchange_wechat_enabled',
    'msg_contact',
    'msg_contact_no_wechat',
    'msg_job_closed',
    'rating_prompt',
    'byo_url',
    'byo_key',
    'byo_model',
    'byo_test_btn',
    'byo_test_result',
    'byo_test_detail',
    'byo_headers',
    'byo_skip_probe',
    'byo_adv_toggle',
    'byo_advanced',
    'btn-save',
    'toast'
  ];
  ids.forEach((id) => elements.set(id, createElement(id)));

  const addClassValue = (className, value, checked = false, attrs = {}) => {
    const el = createElement();
    el.value = value;
    el.checked = checked;
    el.attributes = attrs;
    const list = classGroups.get(className) || [];
    list.push(el);
    classGroups.set(className, list);
    return el;
  };
  const addRadio = (name, value, checked = false) => {
    const el = createElement();
    el.value = value;
    el.checked = checked;
    el.attributes = { name };
    const list = classGroups.get(`input[name="${name}"]`) || [];
    list.push(el);
    classGroups.set(`input[name="${name}"]`, list);
    return el;
  };

  const documentListeners = {};
  const document = {
    addEventListener(type, handler) {
      documentListeners[type] = handler;
    },
    getElementById: (id) => elements.get(id) || null,
    querySelector(selector) {
      if (/^input\[name="[^"]+"\]:checked$/.test(selector)) {
        const name = selector.match(/^input\[name="([^"]+)"\]:checked$/)[1];
        return (classGroups.get(`input[name="${name}"]`) || []).find((el) => el.checked) || null;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector.startsWith('.')) return classGroups.get(selector.slice(1)) || [];
      return classGroups.get(selector) || [];
    }
  };

  const savedSettings = [];
  const api = {
    getSettings: async () => ({}),
    requestByoPermission: async () => ({}),
    saveSettings: async (settings) => {
      savedSettings.push(settings);
      return settings;
    },
    testByo: async () => ({ success: true })
  };

  const window = { BHPPageApi: api, document };
  return { addClassValue, addRadio, classGroups, documentListeners, elements, savedSettings, window };
}

function runOptionsModule(harness) {
  const previousWindow = global.window;
  const previousDocument = global.document;
  const modulePath = require.resolve('../src/ui/options/options.js');
  delete require.cache[modulePath];
  global.window = harness.window;
  global.document = harness.window.document;
  require(modulePath);
  harness.documentListeners.DOMContentLoaded();
  return async () => {
    await new Promise((resolve) => setImmediate(resolve));
    global.window = previousWindow;
    global.document = previousDocument;
    delete require.cache[modulePath];
  };
}

test('options page save includes full screening, messaging and BYO settings', async () => {
  const harness = setupOptionsHarness();
  harness.addClassValue('pf-edu-cb', '本科', true);
  harness.addClassValue('pf-intention-cb', '在职-考虑机会', true);
  harness.addClassValue('pf-exp-cb', '3-5年', true);
  harness.addClassValue('bhp-vipf-cb', '可拨打', true, { 'data-key': 'callPhone' });
  harness.addClassValue('bhp-vipf-cb', '985', true, { 'data-key': 'school' });
  harness.addClassValue('bhp-vipf-cb', '近14天没有', true, { 'data-key': 'recentNotView' });
  harness.addClassValue('grade-cb', 'A', true);
  harness.addClassValue('grade-cb', 'C', true);
  harness.addRadio('reply_mode', 'wechat', false);
  harness.addRadio('reply_mode', 'reply', true);
  harness.addRadio('byo_force_protocol', 'auto', false);
  harness.addRadio('byo_force_protocol', 'anthropic', true);
  harness.addRadio('byo_pdf_mode', 'auto', false);
  harness.addRadio('byo_pdf_mode', 'image', true);
  const activation = createElement();
  activation.value = '今日活跃';
  activation.attributes = { 'data-key': 'activation' };
  harness.classGroups.set('bhp-vipf-radio', [activation]);

  const cleanup = runOptionsModule(harness);
  await new Promise((resolve) => setImmediate(resolve));
  const values = {
    run_time_limit_minutes: '12',
    age_max: '31',
    schools: '清华大学',
    companies: '腾讯',
    pro_age_max: '29',
    pro_schools: '浙江大学',
    pro_companies: '网易',
    pro_followup_msg: '继续聊一下',
    pf_salary: '20-50K',
    msg_greeting: '你好',
    msg_thank: '感谢',
    msg_contact: '加微信聊',
    msg_contact_no_wechat: '继续沟通',
    msg_job_closed: '岗位关闭',
    rating_prompt: '请评级',
    byo_url: 'https://api.example.com/v1',
    byo_key: 'sk-test',
    byo_model: 'model-test',
    byo_headers: 'X-Test: 1'
  };
  for (const [id, value] of Object.entries(values)) harness.elements.get(id).value = value;
  for (const id of ['school_enabled', 'company_enabled', 'pro_school_enabled', 'pro_company_enabled', 'thank_on_fail_enabled', 'invite_on_pass_enabled', 'exchange_wechat_enabled', 'byo_skip_probe']) {
    harness.elements.get(id).checked = true;
  }
  harness.classGroups.get('pf-edu-cb').forEach((el) => { el.checked = el.value === '本科'; });
  harness.classGroups.get('pf-intention-cb').forEach((el) => { el.checked = el.value === '在职-考虑机会'; });
  harness.classGroups.get('pf-exp-cb').forEach((el) => { el.checked = el.value === '3-5年'; });
  harness.classGroups.get('bhp-vipf-cb').forEach((el) => { el.checked = ['可拨打', '985', '近14天没有'].includes(el.value); });
  harness.classGroups.get('grade-cb').forEach((el) => { el.checked = ['A', 'C'].includes(el.value); });
  harness.classGroups.get('input[name="reply_mode"]').forEach((el) => { el.checked = el.value === 'reply'; });
  harness.classGroups.get('input[name="byo_force_protocol"]').forEach((el) => { el.checked = el.value === 'anthropic'; });
  harness.classGroups.get('input[name="byo_pdf_mode"]').forEach((el) => { el.checked = el.value === 'image'; });
  activation.value = '今日活跃';
  try {
    await harness.elements.get('btn-save').onclick();
    const saved = harness.savedSettings[0];
    assert.equal(saved.run_time_limit_minutes, 12);
    assert.equal(saved.proactive_screening.age_max, 29);
    assert.deepEqual(saved.proactive_screening.page_filters.edu, ['本科']);
    assert.deepEqual(saved.proactive_screening.page_filters.intention, ['在职-考虑机会']);
    assert.equal(saved.proactive_screening.page_filters.salary, '20-50K');
    assert.deepEqual(saved.proactive_screening.page_filters.experience, ['3-5年']);
    assert.deepEqual(saved.proactive_screening.page_filters.callPhone, ['可拨打']);
    assert.equal(saved.proactive_screening.vip_filters.activation, '今日活跃');
    assert.deepEqual(saved.proactive_screening.vip_filters.school, ['985']);
    assert.deepEqual(saved.contact_grades, ['A', 'C']);
    assert.equal(saved.messages.thank_on_fail_enabled, true);
    assert.equal(saved.messages.invite_on_pass_enabled, true);
    assert.equal(saved.messages.reply_mode, 'reply');
    assert.equal(saved.byo.enabled, true);
    assert.equal(saved.byo.advanced.force_protocol, 'anthropic');
    assert.equal(saved.byo.advanced.pdf_mode, 'image');
    assert.deepEqual(Object.keys(saved.byo.advanced).sort(), ['force_protocol', 'headers', 'pdf_mode', 'skip_probe']);
  } finally {
    await cleanup();
  }
});

test('options page loads saved proactive filters and grade settings', async () => {
  const harness = setupOptionsHarness();
  const edu = harness.addClassValue('pf-edu-cb', '本科');
  const intention = harness.addClassValue('pf-intention-cb', '在职-考虑机会');
  const exp = harness.addClassValue('pf-exp-cb', '3-5年');
  const callPhone = harness.addClassValue('bhp-vipf-cb', '可拨打', false, { 'data-key': 'callPhone' });
  const school = harness.addClassValue('bhp-vipf-cb', '985', false, { 'data-key': 'school' });
  const gradeA = harness.addClassValue('grade-cb', 'A');
  const gradeD = harness.addClassValue('grade-cb', 'D');
  const reply = harness.addRadio('reply_mode', 'reply');
  harness.addRadio('byo_force_protocol', 'auto');
  const forceGemini = harness.addRadio('byo_force_protocol', 'gemini');
  harness.addRadio('byo_pdf_mode', 'auto');
  const pdfInline = harness.addRadio('byo_pdf_mode', 'inline');
  const activation = createElement();
  activation.value = '';
  activation.attributes = { 'data-key': 'activation' };
  harness.classGroups.set('bhp-vipf-radio', [activation]);
  harness.window.BHPPageApi.getSettings = async () => ({
    run_time_limit_minutes: 11,
    age_max: 32,
    school_filter_enabled: true,
    schools: ['清华大学'],
    company_filter_enabled: true,
    companies: ['腾讯'],
    proactive_screening: {
      age_max: 28,
      school_filter_enabled: true,
      schools: ['浙江大学'],
      company_filter_enabled: true,
      companies: ['网易'],
      followup_msg: '继续聊一下',
      page_filters: {
        edu: ['本科'],
        intention: ['在职-考虑机会'],
        salary: '20-50K',
        experience: ['3-5年'],
        callPhone: ['可拨打']
      },
      vip_filters: {
        activation: '今日活跃',
        school: ['985']
      }
    },
    messages: {
      greeting: '你好',
      thank: '感谢',
      contact: '加微信聊',
      contact_no_wechat: '继续沟通',
      job_closed: '岗位关闭',
      thank_on_fail_enabled: true,
      invite_on_pass_enabled: true,
      reply_mode: 'reply',
      exchange_wechat_enabled: true
    },
    contact_grades: ['A', 'D'],
    rating_prompt: '请评级',
    byo: {
      enabled: true,
      url: 'https://api.example.com/v1',
      key: 'sk-test',
      model: 'model-test',
      advanced: {
        force_protocol: 'gemini',
        headers: 'X-Test: 1',
        pdf_mode: 'inline',
        skip_probe: true
      }
    }
  });

  const cleanup = runOptionsModule(harness);
  try {
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(harness.elements.get('run_time_limit_minutes').value, 11);
    assert.equal(harness.elements.get('run_time_limit_minutes_value').textContent, '11 分钟');
    assert.equal(harness.elements.get('pro_age_max').value, 28);
    assert.equal(harness.elements.get('pro_schools').value, '浙江大学');
    assert.equal(harness.elements.get('pro_followup_msg').value, '继续聊一下');
    assert.equal(harness.elements.get('pf_salary').value, '20-50K');
    assert.equal(harness.elements.get('thank_on_fail_enabled').checked, true);
    assert.equal(harness.elements.get('invite_on_pass_enabled').checked, true);
    assert.equal(reply.checked, true);
    assert.equal(edu.checked, true);
    assert.equal(intention.checked, true);
    assert.equal(exp.checked, true);
    assert.equal(callPhone.checked, true);
    assert.equal(school.checked, true);
    assert.equal(activation.value, '今日活跃');
    assert.equal(gradeA.checked, true);
    assert.equal(gradeD.checked, true);
    assert.equal(forceGemini.checked, true);
    assert.equal(pdfInline.checked, true);
  } finally {
    await cleanup();
  }
});

test('options page syncs run limit label and handles empty BYO test feedback', async () => {
  const harness = setupOptionsHarness();
  harness.window.BHPPageApi.requestByoPermission = async () => {
    throw new Error('请先填写 Base URL');
  };

  const cleanup = runOptionsModule(harness);
  try {
    await new Promise((resolve) => setImmediate(resolve));
    harness.elements.get('run_time_limit_minutes').value = '9';
    harness.elements.get('run_time_limit_minutes').oninput();
    assert.equal(harness.elements.get('run_time_limit_minutes_value').textContent, '9 分钟');

    await harness.elements.get('byo_test_btn').onclick();
    assert.equal(harness.elements.get('byo_test_result').textContent, '连接失败');
    assert.equal(harness.elements.get('byo_test_detail').textContent, '请先填写 Base URL');

    harness.elements.get('byo_adv_toggle').onclick();
    assert.equal(harness.elements.get('byo_advanced').classList.contains('show'), true);
  } finally {
    await cleanup();
  }
});
