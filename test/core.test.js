const test = require('node:test');
const assert = require('node:assert/strict');

const settings = require('../src/modules/settings.js');
const filters = require('../src/modules/filters.js');
const messaging = require('../src/modules/messaging.js');
const byo = require('../src/modules/byo-provider.js');

test('settings deep merge keeps nested defaults and clamps run limit', () => {
  const merged = settings.mergeSettings({
    run_time_limit_minutes: 99,
    messages: { contact: '欢迎聊聊', thank_on_fail_enabled: true },
    byo: { enabled: true, model: 'gpt-4o' }
  });

  assert.equal(merged.run_time_limit_minutes, 15);
  assert.equal(merged.age_max, 30);
  assert.equal(merged.messages.greeting, settings.DEFAULT_SETTINGS.messages.greeting);
  assert.equal(merged.messages.contact, '欢迎聊聊');
  assert.equal(merged.messages.thank_on_fail_enabled, true);
  assert.equal(merged.byo.enabled, true);
  assert.equal(merged.byo.advanced.force_protocol, 'auto');
});

test('candidate filter treats age as required and school/company as OR', () => {
  const cfg = settings.mergeSettings({
    age_max: 30,
    school_filter_enabled: true,
    schools: ['清华大学'],
    company_filter_enabled: true,
    companies: ['腾讯']
  });

  assert.deepEqual(filters.evaluateCandidate({ age: 31, school: '清华大学', company: '腾讯' }, cfg), {
    passed: false,
    reason: '年龄超过上限'
  });
  assert.equal(filters.evaluateCandidate({ age: 24, school: '清华大学', company: '小公司' }, cfg).passed, true);
  assert.equal(filters.evaluateCandidate({ age: 24, school: '普通本科', company: '腾讯科技' }, cfg).passed, true);
  assert.deepEqual(filters.evaluateCandidate({ age: 24, school: '普通本科', company: '小公司' }, cfg), {
    passed: false,
    reason: '学校和公司均不在白名单'
  });
});

test('candidate filter requires enabled whitelist to match when it is the only whitelist', () => {
  const cfg = settings.mergeSettings({
    school_filter_enabled: true,
    schools: ['985'],
    company_filter_enabled: false,
    companies: []
  });

  assert.equal(filters.evaluateCandidate({ age: 25, school: '985高校', company: '' }, cfg).passed, true);
  assert.deepEqual(filters.evaluateCandidate({ age: 25, school: '普通本科', company: '' }, cfg), {
    passed: false,
    reason: '学校不在白名单'
  });
});

test('message decision follows contact grades and empty-template skip rules', () => {
  const cfg = settings.mergeSettings({
    contact_grades: ['A', 'B'],
    messages: {
      invite_on_pass_enabled: true,
      reply_mode: 'reply',
      contact: '交换微信文本',
      contact_no_wechat: '仅回复文本',
      thank_on_fail_enabled: true,
      thank: '感谢关注'
    }
  });

  assert.deepEqual(messaging.decideMessageForRating({ rating: 'B' }, cfg), {
    action: 'reply',
    message: '仅回复文本',
    shouldExchangeWechat: false
  });
  assert.deepEqual(messaging.decideMessageForRating({ rating: 'D' }, cfg), {
    action: 'thank',
    message: '感谢关注',
    shouldExchangeWechat: false
  });

  const blank = settings.mergeSettings({
    contact_grades: ['A'],
    messages: { invite_on_pass_enabled: true, contact: '', contact_no_wechat: '' }
  });
  assert.deepEqual(messaging.decideMessageForRating({ rating: 'A' }, blank), {
    action: 'skip',
    reason: '邀约话术为空'
  });
});

test('message templates support documented aliases and business failure thank messages', () => {
  assert.equal(
    messaging.renderMessageTemplate(
      '你好 {候选人姓名}\n\n\n岗位：{岗位名称}\n评级：{评级等级}',
      { candidate_name: '张三', job_title: '前端工程师', rating: 'B' }
    ),
    '你好 张三\n\n岗位：前端工程师\n评级：B'
  );

  const cfg = settings.mergeSettings({
    messages: {
      thank_on_fail_enabled: true,
      thank: '感谢 {candidate_name} 关注，{评级摘要}'
    }
  });

  assert.deepEqual(messaging.decideMessageForBusinessFailure({
    reason: '年龄超过上限',
    candidate: { candidate_name: '李四' }
  }, cfg), {
    action: 'thank',
    message: '感谢 李四 关注，年龄超过上限',
    shouldExchangeWechat: false
  });
});

test('byo provider detects protocol, parses headers and extracts ratings', () => {
  assert.equal(byo.detectProtocol({ url: 'https://api.anthropic.com', forceProtocol: 'auto' }), 'anthropic');
  assert.equal(byo.detectProtocol({ url: 'https://generativelanguage.googleapis.com', forceProtocol: 'auto' }), 'gemini');
  assert.equal(byo.detectProtocol({ url: 'https://relay.example.com/v1', forceProtocol: 'auto' }), 'openai');
  assert.equal(byo.detectProtocol({ url: 'https://relay.example.com', forceProtocol: 'gemini' }), 'gemini');

  assert.equal(byo.isProbablyMultimodal('gpt-4o-mini'), true);
  assert.equal(byo.isProbablyMultimodal('deepseek-chat'), false);
  assert.deepEqual(byo.parseHeaderLines('X-Route: a\nBadLine\nX-Flag: yes'), {
    'X-Route': 'a',
    'X-Flag': 'yes'
  });

  const text = '```json\n{"rating":"b","summary":"匹配","risk":"项目偏少"}\n```';
  assert.deepEqual(byo.extractRatingFromText(text), {
    rating: 'B',
    summary: '匹配',
    risk: '项目偏少'
  });

  assert.deepEqual(byo.extractRatingFromResponse({
    choices: [{ message: { content: text } }]
  }), {
    rating: 'B',
    summary: '匹配',
    risk: '项目偏少'
  });

  assert.equal(byo.extractTextFromResponse({
    choices: [{ message: { content: '{"greeting":"你好"}' } }]
  }), '{"greeting":"你好"}');
  assert.equal(byo.extractTextFromResponse({
    content: [{ text: 'anthropic text' }]
  }), 'anthropic text');
  assert.equal(byo.extractTextFromResponse({
    candidates: [{ content: { parts: [{ text: 'gemini text' }] } }]
  }), 'gemini text');
});
