(function initMonitorUi(root) {
  'use strict';

  const api = root.BHPPageApi;
  const $ = (id) => document.getElementById(id);
  const START_ACTION_IDS = [
    'btn-follow',
    'btn-proactive',
    'btn-new',
    'btn-chat',
    'btn-smart',
    'btn-pro-followup',
    'btn-pro-greet',
    'btn-pro-smart'
  ];
  const ACTION_GROUPS = {
    follow: {
      button: 'btn-follow',
      panel: 'follow-options',
      title: '智能跟进',
      options: {
        new: '处理新招呼',
        chat: '处理沟通中',
        smart: '智能处理'
      }
    },
    proactive: {
      button: 'btn-proactive',
      panel: 'proactive-options',
      title: '牛人筛选',
      options: {
        followup: '牛人跟进',
        greet: '给牛人打招呼',
        smart: '智能筛选'
      }
    }
  };
  const TEMPLATE_FIELDS = {
    greeting: 's-msg-greeting',
    thank: 's-msg-thank',
    contact: 's-msg-contact',
    contact_no_wechat: 's-msg-contact-no-wechat',
    job_closed: 's-msg-job-closed',
    proactive_followup: 's-pro-followup-msg'
  };
  const presetList = (text) => text.trim().split(/\s*,\s*/).filter(Boolean);
  const SCHOOL_PRESETS = {
    985: presetList(`
      北京大学,清华大学,中国人民大学,北京航空航天大学,北京理工大学,北京师范大学,中国农业大学,中央民族大学,
      南开大学,天津大学,大连理工大学,东北大学,吉林大学,哈尔滨工业大学,复旦大学,上海交通大学,
      同济大学,华东师范大学,南京大学,东南大学,浙江大学,中国科学技术大学,厦门大学,山东大学,
      中国海洋大学,武汉大学,华中科技大学,中南大学,湖南大学,中山大学,华南理工大学,四川大学,
      电子科技大学,重庆大学,西安交通大学,西北工业大学,西北农林科技大学,兰州大学,国防科技大学
    `),
    211: presetList(`
      北京大学,清华大学,中国人民大学,北京航空航天大学,北京理工大学,北京师范大学,中国农业大学,中央民族大学,
      北京交通大学,北京工业大学,北京科技大学,北京化工大学,北京邮电大学,北京林业大学,北京中医药大学,
      北京外国语大学,中国传媒大学,中央财经大学,对外经济贸易大学,中国政法大学,华北电力大学,北京体育大学,
      中央音乐学院,南开大学,天津大学,天津医科大学,河北工业大学,太原理工大学,内蒙古大学,辽宁大学,
      大连理工大学,东北大学,大连海事大学,吉林大学,延边大学,东北师范大学,哈尔滨工业大学,哈尔滨工程大学,
      东北农业大学,东北林业大学,复旦大学,上海交通大学,同济大学,华东师范大学,华东理工大学,东华大学,
      上海外国语大学,上海财经大学,上海大学,南京大学,东南大学,南京航空航天大学,南京理工大学,河海大学,
      南京农业大学,中国药科大学,南京师范大学,江南大学,苏州大学,中国矿业大学,浙江大学,安徽大学,
      合肥工业大学,中国科学技术大学,福州大学,厦门大学,南昌大学,山东大学,中国海洋大学,中国石油大学,
      郑州大学,武汉大学,华中科技大学,武汉理工大学,中国地质大学,华中农业大学,华中师范大学,
      中南财经政法大学,中南大学,湖南大学,湖南师范大学,中山大学,华南理工大学,暨南大学,华南师范大学,
      广西大学,海南大学,四川大学,电子科技大学,西南交通大学,西南财经大学,重庆大学,西南大学,贵州大学,
      云南大学,西藏大学,西安交通大学,西北工业大学,西安电子科技大学,长安大学,西北农林科技大学,
      陕西师范大学,兰州大学,青海大学,宁夏大学,新疆大学,石河子大学,国防科技大学
    `),
    syl: presetList(`
      北京大学,清华大学,中国人民大学,北京航空航天大学,北京理工大学,北京师范大学,中国农业大学,中央民族大学,
      北京交通大学,北京工业大学,北京科技大学,北京化工大学,北京邮电大学,北京林业大学,北京中医药大学,
      北京外国语大学,中国传媒大学,中央财经大学,对外经济贸易大学,中国政法大学,华北电力大学,北京体育大学,
      中央音乐学院,中国音乐学院,中央美术学院,首都师范大学,北京协和医学院,中国科学院大学,南开大学,
      天津大学,天津医科大学,天津工业大学,河北工业大学,太原理工大学,山西大学,内蒙古大学,辽宁大学,
      大连理工大学,东北大学,大连海事大学,吉林大学,延边大学,东北师范大学,哈尔滨工业大学,哈尔滨工程大学,
      东北农业大学,东北林业大学,复旦大学,上海交通大学,同济大学,华东师范大学,华东理工大学,东华大学,
      上海外国语大学,上海财经大学,上海大学,上海科技大学,南京大学,东南大学,南京航空航天大学,南京理工大学,
      河海大学,南京农业大学,中国药科大学,南京师范大学,江南大学,苏州大学,中国矿业大学,南京医科大学,
      南京信息工程大学,南京林业大学,浙江大学,中国美术学院,宁波大学,安徽大学,合肥工业大学,
      中国科学技术大学,福州大学,厦门大学,南昌大学,山东大学,中国海洋大学,中国石油大学,郑州大学,
      河南大学,武汉大学,华中科技大学,武汉理工大学,中国地质大学,华中农业大学,华中师范大学,
      中南财经政法大学,中南大学,湖南大学,湖南师范大学,湘潭大学,中山大学,华南理工大学,暨南大学,
      华南师范大学,华南农业大学,广州医科大学,广西大学,海南大学,四川大学,电子科技大学,西南交通大学,
      西南财经大学,重庆大学,西南大学,贵州大学,云南大学,西藏大学,西安交通大学,西北工业大学,
      西安电子科技大学,长安大学,西北农林科技大学,陕西师范大学,兰州大学,青海大学,宁夏大学,
      新疆大学,石河子大学,南方科技大学,国防科技大学
    `)
  };
  const COMPANY_PRESETS = {
    game: presetList(`
      腾讯,网易,米哈游,莉莉丝,叠纸,鹰角,沐瞳,紫龙,游族,三七互娱,完美世界,盛趣游戏,西山居,
      心动,散爆,库洛,朝夕光年,祖龙,雷霆游戏,青瓷游戏,吉比特,乐元素,FunPlus,IGG,
      智明星通,龙创悦动,龙腾简合,点点互动,沙盒网络,凯撒文化,4399
    `),
    bigtech: presetList(`
      腾讯,阿里巴巴,字节跳动,百度,美团,京东,拼多多,网易,华为,小米,OPPO,vivo,快手,滴滴,
      蚂蚁集团,微软,谷歌,亚马逊,苹果,Meta,英伟达,三星,索尼,任天堂,Epic Games,EA,育碧,
      暴雪,Riot Games,Supercell
    `)
  };
  const DEFAULT_RATING_PROMPT = '请分析这份简历并给出评级。严格按 JSON 输出：{"rating":"A/B/C/D","summary":"一句话优势","risk":"一句话风险"}';
  let lastProcessLog = [];
  let lastRatingResults = [];
  let settingsToastTimer = null;

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value == null || value === '' ? '-' : String(value);
  }

  function setValue(id, value) {
    const el = $(id);
    if (el && value !== undefined && value !== null) el.value = value;
  }

  function setChecked(id, checked) {
    const el = $(id);
    if (el) el.checked = Boolean(checked);
  }

  function setDot(id, tone) {
    const el = $(id);
    if (el) el.className = `dot ${tone || ''}`.trim();
  }

  function show(id, visible, display = '') {
    const el = $(id);
    if (el) el.style.display = visible ? display : 'none';
  }

  function showSettingsToast(message, { error = false, duration = 2600 } = {}) {
    const toast = $('settings-toast');
    if (!toast) return;
    if (settingsToastTimer) clearTimeout(settingsToastTimer);
    toast.classList.toggle('err', Boolean(error));
    toast.textContent = message || '';
    if (message && duration > 0) {
      settingsToastTimer = setTimeout(() => {
        toast.textContent = '';
        toast.classList.remove('err');
        settingsToastTimer = null;
      }, duration);
    }
  }

  function setDisabled(id, disabled) {
    const el = $(id);
    if (el) el.disabled = Boolean(disabled);
  }

  function addClass(id, className) {
    $(id)?.classList?.add(className);
  }

  function removeClass(id, className) {
    $(id)?.classList?.remove(className);
  }

  function escapeHtml(text) {
    return String(text || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
  }

  function appendLog(text, kind = 'info') {
    const log = $('log');
    if (!log) return;
    const row = document.createElement('div');
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });
    row.innerHTML = `<span class="log-ts">${time}</span><span class="log-${kind}">${escapeHtml(text)}</span>`;
    log.prepend(row);
    show('status-card', true);
  }

  function setRunning(running) {
    const stop = $('btn-stop');
    if (stop) stop.disabled = !running;
    for (const id of START_ACTION_IDS) setDisabled(id, running);
    show('status-card', true);
    setText('status', running ? '运行中...' : '等待启动...');
    setText('run-mode-title', running ? '运行中：自动化处理' : '等待启动');
    setText(
      'run-mode-subtitle',
      running
        ? '当前任务会持续更新列表级进度，点击停止后会在当前候选人处理完成后退出。'
        : '选择跟进或牛人筛选后，将显示列表级进度和处理日志。'
    );
  }

  function minuteText(ms) {
    const minutes = Math.max(1, Math.ceil(Number(ms || 0) / 60000));
    return `${minutes} 分钟`;
  }

  function applyPauseState(pause = {}) {
    const paused = Boolean(pause?.paused);
    if (!paused) {
      root.BHPPauseUi?.hide?.();
      return;
    }
    const ttlText = pause.ttlRemainingMs ? `可在 ${minuteText(pause.ttlRemainingMs)} 内继续` : '可继续';
    const runText = pause.remainingMs ? `剩余约 ${minuteText(pause.remainingMs)}` : '';
    const text = ['已暂停', ttlText, runText].filter(Boolean).join('，');
    root.BHPPauseUi?.show?.(text);
    setText('run-mode-title', '已暂停');
    setText('run-mode-subtitle', '可以继续上次任务，或放弃暂停态后重新选择跟进/筛选。');
    setText('status', text);
  }

  function statNumber(value) {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
  }

  function shortTime(value) {
    const date = value ? new Date(value) : new Date();
    if (!Number.isFinite(date.getTime())) return '';
    return date.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });
  }

  function logKindMeta(kind) {
    const map = {
      business_failure: ['业务不通过', 'fail'],
      system_failure: ['系统失败', 'fail'],
      rated: ['已评级', 'pass'],
      sent: ['已发送', 'done'],
      skipped: ['已跳过', 'info']
    };
    return map[kind] || ['记录', 'info'];
  }

  function renderProcessLog(processLog) {
    if (!Array.isArray(processLog)) return;
    lastProcessLog = processLog.slice();
    const list = $('run-list');
    if (!list) return;
    const rows = processLog.slice(0, 12);
    setText('run-count', rows.length);
    if (!rows.length) {
      list.innerHTML = '<div class="empty-state">暂无今日记录</div>';
      return;
    }
    list.innerHTML = rows.map((entry, index) => {
      const [label, tone] = logKindMeta(entry.kind);
      const name = entry.candidateName || entry.candidateId || '候选人';
      return [
        '<div class="run-entry">',
        `<span class="run-idx">${index + 1}</span>`,
        '<div class="run-body">',
        '<div class="run-head">',
        `<span class="log-ts">${escapeHtml(shortTime(entry.time))}</span>`,
        `<span class="log-${tone}">${escapeHtml(label)}</span>`,
        `<span class="run-type">${escapeHtml(name)}</span>`,
        '</div>',
        `<span class="run-stats">${escapeHtml(entry.text || '')}</span>`,
        '</div>',
        '</div>'
      ].join('');
    }).join('');
  }

  function normalizeGrade(value) {
    const grade = String(value || '').trim().toUpperCase().charAt(0);
    return ['A', 'B', 'C', 'D'].includes(grade) ? grade : 'D';
  }

  function renderRatingResults(ratingResults) {
    if (!Array.isArray(ratingResults)) return;
    lastRatingResults = ratingResults.slice();
    const rows = ratingResults.slice(0, 30);
    show('rating-results', rows.length > 0);
    setText('rating-count', rows.length);

    const counts = { A: 0, B: 0, C: 0, D: 0 };
    rows.forEach((item) => { counts[normalizeGrade(item.rating)] += 1; });
    const total = Math.max(rows.length, 1);
    const dist = $('rating-dist');
    if (dist) {
      dist.innerHTML = ['A', 'B', 'C', 'D'].map((grade) => {
        const width = Math.round((counts[grade] / total) * 100);
        const lower = grade.toLowerCase();
        return [
          '<div class="rating-dist-row">',
          `<span class="rating-dist-label grade-${lower}">${grade}</span>`,
          '<div class="rating-dist-bar">',
          `<div class="rating-dist-bar-fill rating-dist-fill-${lower}" style="width:${width}%;"></div>`,
          '</div>',
          `<span class="rating-dist-count">${counts[grade]}</span>`,
          '</div>'
        ].join('');
      }).join('');
    }

    const list = $('rating-list-inline');
    if (list) {
      list.innerHTML = rows.map((item) => {
        const grade = normalizeGrade(item.rating);
        const lower = grade.toLowerCase();
        const name = item.candidateName || item.name || item.candidateId || '候选人';
        return [
          '<div class="rating-entry">',
          `<span class="log-tag log-tag-${lower}">${grade}级</span>`,
          `<span class="r-name">${escapeHtml(name)}</span>`,
          `<span class="r-job">${escapeHtml(item.summary || item.reason || '')}</span>`,
          '</div>'
        ].join('');
      }).join('');
    }
  }

  function detailEmpty(text) {
    return `<div class="empty-state">${escapeHtml(text)}</div>`;
  }

  function processLogDetailHtml(rows) {
    if (!rows.length) return detailEmpty('暂无今日记录');
    return rows.map((entry, index) => {
      const [label, tone] = logKindMeta(entry.kind);
      const name = entry.candidateName || entry.candidateId || '候选人';
      return [
        '<div class="summary-card">',
        `<span class="run-idx">${index + 1}</span>`,
        `<span class="log-ts">${escapeHtml(shortTime(entry.time))}</span>`,
        `<span class="log-${tone}">${escapeHtml(label)}</span>`,
        `<span class="run-type">${escapeHtml(name)}</span>`,
        `<div class="log-rating-detail">${escapeHtml(entry.text || '')}</div>`,
        '</div>'
      ].join('');
    }).join('');
  }

  function ratingDetailHtml(rows) {
    if (!rows.length) return detailEmpty('暂无简历评级');
    return rows.map((item) => {
      const grade = normalizeGrade(item.rating);
      const lower = grade.toLowerCase();
      const name = item.candidateName || item.name || item.candidateId || '候选人';
      return [
        '<div class="log-rating">',
        `<span class="log-tag log-tag-${lower}">${grade}级</span>`,
        `<span class="r-name">${escapeHtml(name)}</span>`,
        `<div class="log-rating-detail">${escapeHtml(item.summary || item.reason || '')}</div>`,
        item.risk ? `<div class="log-rating-detail" style="color:var(--red);">${escapeHtml(item.risk)}</div>` : '',
        '</div>'
      ].join('');
    }).join('');
  }

  function openDetailOverlay(title, bodyHtml) {
    setText('detail-overlay-title', title);
    const body = $('detail-overlay-body');
    if (body) body.innerHTML = bodyHtml;
    const overlay = $('detail-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('visible'));
  }

  function closeDetailOverlay() {
    const overlay = $('detail-overlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    setTimeout(() => { overlay.style.display = 'none'; }, 220);
  }

  function bindDetailOverlay() {
    $('btn-daily-summary')?.addEventListener('click', () => {
      openDetailOverlay(`今日记录 ${lastProcessLog.length}`, processLogDetailHtml(lastProcessLog));
    });
    $('rating-toggle')?.addEventListener('click', () => {
      openDetailOverlay(`简历评级 ${lastRatingResults.length}`, ratingDetailHtml(lastRatingResults));
    });
    $('detail-back-btn')?.addEventListener('click', closeDetailOverlay);
  }

  function setPipeState(id, state) {
    const el = $(id);
    if (el) el.className = `pipe-step${state ? ` ${state}` : ''}`;
  }

  function renderCheckpointPipeline(snapshot = {}) {
    const checkpoint = snapshot.checkpoint || {};
    const stats = snapshot.stats || {};
    const cursor = statNumber(checkpoint.cursor ?? snapshot.processedIds?.length ?? stats.processed);
    const visible = checkpoint.level === 'list' || Boolean(snapshot.running) || cursor > 0;
    show('pipeline-card', visible);
    if (!visible) return;

    setText('pipeline-cursor', `列表检查点 ${cursor}`);
    const processed = statNumber(stats.processed);
    const rated = statNumber(stats.rated);
    const sent = statNumber(stats.greeted) + statNumber(stats.replied);
    const failed = statNumber(stats.businessFailed) + statNumber(stats.systemFailed);

    setPipeState('pipe-scan', 'done');
    setPipeState('pipe-filter', processed || failed || rated ? 'done' : 'active');
    setPipeState('pipe-resume', rated || statNumber(stats.systemFailed) ? 'done' : (processed ? 'active' : ''));
    setPipeState('pipe-ai', rated ? 'done' : (processed ? 'active' : ''));
    setPipeState('pipe-send', sent ? 'done' : (rated ? 'active' : ''));
    setPipeState('pipe-record', snapshot.running ? 'active' : (processed ? 'done' : ''));
  }

  function updateStats(snapshot = {}) {
    const stats = snapshot.stats || {};
    const contacted = statNumber(stats.greeted) + statNumber(stats.replied);
    setText('stat-processed', statNumber(stats.processed));
    setText('stat-new', statNumber(stats.new));
    setText('stat-chat', statNumber(stats.chat));
    setText('stat-proactive', statNumber(stats.greeted || stats.proactive));
    setText('stat-rated', statNumber(stats.rated));
    setText('stat-resume', statNumber(stats.resumeCaptured || stats.resume || stats.resumes));
    setText('stat-top', statNumber(stats.top || stats.qualified || contacted));
    setText('stat-business-failed', statNumber(stats.businessFailed));
  }

  function byoHost(url) {
    try {
      return new URL(url).host || '';
    } catch (error) {
      return '';
    }
  }

  function applyByoReadiness(settings = {}) {
    const byo = settings.byo || {};
    const host = byoHost(byo.url);
    const configured = Boolean(byo.url && byo.key && byo.model);
    const label = configured ? '已配置' : '未配置';
    const summary = configured ? (host || '自定义 API') : '未配置';
    const tone = configured ? 'ok' : 'warn';

    setDot('byo-dot', tone);
    setDot('settings-byo-dot', tone);
    setText('byo-ready', label);
    setText('settings-byo-ready', label);
    setText('byo-summary', summary);
  }

  function schemaGroup(schema = {}, key) {
    return (Array.isArray(schema.groups) ? schema.groups : []).find((group) => group?.key === key) || null;
  }

  function dynamicOptionsFromSchema(schema = {}) {
    const valuesFor = (key) => (Array.isArray(schemaGroup(schema, key)?.options) ? schemaGroup(schema, key).options : [])
      .map((item) => String(item?.text || item || '').trim())
      .filter(Boolean);
    return {
      major: valuesFor('major'),
      keyword1: valuesFor('keyword1'),
      updated_at: schema.ts || new Date().toISOString()
    };
  }

  function renderDynamicFilterOptions(containerId, metaId, key, options = [], selected = []) {
    const container = $(containerId);
    const meta = $(metaId);
    const selectedSet = new Set((Array.isArray(selected) ? selected : []).map((item) => String(item)));
    const values = Array.from(new Set((Array.isArray(options) ? options : []).map((item) => String(item).trim()).filter(Boolean)));
    if (meta) meta.textContent = values.length ? `（共 ${values.length} 项）` : '（尚未采集）';
    if (!container) return;
    if (!values.length) {
      container.innerHTML = '<span style="color:var(--text-dim);">尚未采集</span>';
      return;
    }
    container.innerHTML = values.map((value) => {
      const checked = selectedSet.has(value) ? ' checked' : '';
      return [
        '<label style="font-size:12px;display:flex;align-items:center;gap:4px;">',
        `<input type="checkbox" class="s-bhp-vipf-cb" data-key="${key}" value="${escapeHtml(value)}"${checked}>`,
        escapeHtml(value),
        '</label>'
      ].join('');
    }).join('');
  }

  function renderVipDynamicOptions(dynamicOptions = {}, vipFilters = {}) {
    renderDynamicFilterOptions('s-vip_major_options', 's-vip_major_meta', 'major', dynamicOptions.major, vipFilters.major);
    renderDynamicFilterOptions('s-vip_keyword1_options', 's-vip_keyword1_meta', 'keyword1', dynamicOptions.keyword1, vipFilters.keyword1);
  }

  function setDiagnosticsVisible(visible) {
    show('debug-log-card', visible);
    show('sniffer-card', visible);
    show('netlog-section', visible);
  }

  function applyAutomationSnapshot(snapshot = {}) {
    setRunning(Boolean(snapshot.running));
    updateStats(snapshot);
    renderCheckpointPipeline(snapshot);
    renderProcessLog(snapshot.processLog);
    renderRatingResults(snapshot.ratingResults);
    if (snapshot.lastText) setText('status', snapshot.lastText);
    if (snapshot.lastStats) setText('status-run-limit', snapshot.lastStats);
  }

  function applyStatus(status) {
    show('logged-area', true);
    show('actions-card', true);
    show('stats-card-4', true);
    show('btn-settings-hd', true);

    const bossLoggedIn = Boolean(status?.boss?.loggedIn);
    const bossVip = Boolean(status?.boss?.vip);
    const bossUser = status?.boss?.user || '招聘账号';
    setDot('boss-dot', bossLoggedIn ? 'ok' : 'err');
    setDot('settings-boss-dot', bossLoggedIn ? 'ok' : 'err');
    setText('boss-ready', bossLoggedIn ? '已登录' : '未登录');
    setText('settings-boss-ready', bossLoggedIn ? '已登录' : '未登录');
    setText('account-name', bossLoggedIn ? `${bossUser} · 招聘账号` : '招聘账号');
    setText('boss-user', bossLoggedIn ? bossUser : '未检测');
    show('s-vip_filters_block', bossVip);
    setText('top-usage', `跟进 ${status?.dailyUsage?.follow_runs || 0} / 牛人 ${status?.dailyUsage?.proactive_runs || 0}`);
    setText('new-greet', status?.boss?.newGreetingCount ?? 0);
    const proactiveResumeViews = statNumber(status?.dailyUsage?.proactive_resume_views);
    setText('proactive-cap-count', proactiveResumeViews);
    setText('proactive-cap-ready', proactiveResumeViews);
    setText('settings-proactive-cap-ready', proactiveResumeViews);
    const capLine = $('proactive-cap-line');
    if (capLine) {
      capLine.className = 'proactive-cap-hint';
    }

    const auto = status?.automation || {};
    setRunning(Boolean(auto.running));
    if (auto.lastText) setText('status', auto.lastText);
    if (auto.lastStats) setText('status-run-limit', auto.lastStats);
    applyPauseState(status?.pause);
  }

  async function refreshStatus() {
    try {
      applyStatus(await api.getStatus());
    } catch (error) {
      setText('status', error.message);
    }
  }

  function bindSettingsOverlay() {
    const open = async () => {
      const overlay = $('settings-overlay');
      if (!overlay) return;
      overlay.style.display = 'flex';
      requestAnimationFrame(() => overlay.classList.add('visible'));
      const settings = await refreshSettings();
      if (settings && !isByoConfigured(settings)) {
        showByoSetupModal('开始使用招聘设置前，请先配置自定义 AI。AI 评级和话术生成只会调用你填写的 API，不会使用内置服务。');
      }
    };
    const close = () => {
      const overlay = $('settings-overlay');
      if (!overlay) return;
      overlay.classList.remove('visible');
      setTimeout(() => { overlay.style.display = 'none'; }, 220);
    };
    $('btn-settings-hd')?.addEventListener('click', open);
    $('settings-back-btn')?.addEventListener('click', close);
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

  function lines(value) {
    return Array.isArray(value) ? value.join('\n') : String(value || '');
  }

  function splitLines(value) {
    return String(value || '')
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function dispatchFieldEvents(el) {
    const EventCtor = root.Event || globalThis.Event;
    if (!EventCtor || !el?.dispatchEvent) return;
    for (const type of ['input', 'change']) {
      try {
        el.dispatchEvent(new EventCtor(type, { bubbles: true }));
      } catch (_) {
        // Some test shims do not implement DOM Event constructors fully.
      }
    }
  }

  function appendPresetLines(targetId, items = []) {
    const target = $(targetId);
    if (!target) return;
    const values = splitLines(target.value);
    const seen = new Set(values);
    for (const item of items) {
      const value = String(item || '').trim();
      if (!value || seen.has(value)) continue;
      values.push(value);
      seen.add(value);
    }
    target.value = values.join('\n');
    dispatchFieldEvents(target);
  }

  function syncRunTimeLimitLabel() {
    const value = Number($('s-run-time-limit-minutes')?.value || 15);
    setText('s-run-time-limit-minutes-value', `${Number.isFinite(value) ? value : 15} 分钟`);
  }

  function loadSettingsToSidePanel(settings = {}) {
    const pro = settings.proactive_screening || {};
    const pageFilters = pro.page_filters || {};
    const vipFilters = pro.vip_filters || {};
    const dynamicOptions = pro.vip_dynamic_options || {};
    const messages = settings.messages || {};
    const byo = settings.byo || {};
    const byoAdvanced = byo.advanced || {};

    applyByoReadiness(settings);

    setValue('s-run-time-limit-minutes', settings.run_time_limit_minutes ?? 15);
    syncRunTimeLimitLabel();
    setValue('s-age-max', settings.age_max ?? 30);
    setChecked('s-school-enabled', settings.school_filter_enabled);
    setValue('s-schools', lines(settings.schools));
    setChecked('s-company-enabled', settings.company_filter_enabled);
    setValue('s-companies', lines(settings.companies));

    setValue('s-pro-age-max', pro.age_max ?? 30);
    setChecked('s-pro-school-enabled', pro.school_filter_enabled);
    setValue('s-pro-schools', lines(pro.schools));
    setChecked('s-pro-company-enabled', pro.company_filter_enabled);
    setValue('s-pro-companies', lines(pro.companies));
    setValue('s-pro-followup-msg', pro.followup_msg || '');
    setCheckedValues('.s-pf-edu-cb', pageFilters.edu || []);
    setCheckedValues('.s-pf-intention-cb', pageFilters.intention || []);
    setValue('s-pf-salary', pageFilters.salary || '');
    setCheckedValues('.s-pf-exp-cb', pageFilters.experience || []);
    setCheckedValuesByDataKey('.s-bhp-vipf-cb', {
      ...vipFilters,
      callPhone: pageFilters.callPhone || vipFilters.callPhone || []
    });
    setValuesByDataKey('.s-bhp-vipf-radio', vipFilters);
    renderVipDynamicOptions(dynamicOptions, vipFilters);

    setValue('s-msg-greeting', messages.greeting || '');
    setValue('s-msg-thank', messages.thank || '');
    setValue('s-msg-contact', messages.contact || '');
    setValue('s-msg-contact-no-wechat', messages.contact_no_wechat || '');
    setValue('s-msg-job-closed', messages.job_closed || '');
    setChecked('s-thank-on-fail-enabled', messages.thank_on_fail_enabled);
    setChecked('s-invite-on-pass-enabled', messages.invite_on_pass_enabled);
    setChecked('s-reply-mode-reply', messages.reply_mode === 'reply');
    setChecked('s-reply-mode-wechat', messages.reply_mode !== 'reply');
    setChecked('s-exchange-wechat-enabled', messages.exchange_wechat_enabled !== false);
    setCheckedValues('.s-grade-cb', settings.contact_grades || ['A', 'B']);
    setValue('s-rating-prompt', ratingPromptOrDefault(settings.rating_prompt));

    setValue('s-byo-url', byo.url || '');
    setValue('s-byo-key', byo.key || '');
    setValue('s-byo-model', byo.model || '');
    setValue('s-byo-headers', byoAdvanced.headers || '');
    setRadioValue('s-byo-force-protocol', byoAdvanced.force_protocol || 'auto');
    setRadioValue('s-byo-pdf-mode', byoAdvanced.pdf_mode || 'auto');
    setChecked('s-byo-skip-probe', byoAdvanced.skip_probe);

    setChecked('s-auto-download-log', settings.auto_download_log);
    setChecked('s-debug-enabled', settings.debug_enabled);
    setDiagnosticsVisible(Boolean(settings.debug_enabled));
  }

  function isByoConfigured(settings) {
    const byo = settings?.byo || {};
    return Boolean(byo.url && byo.key && byo.model);
  }

  function normalizePrompt(value) {
    return String(value || '').trim();
  }

  function ratingPromptOrDefault(value) {
    return normalizePrompt(value) || DEFAULT_RATING_PROMPT;
  }

  function hasCustomRatingPrompt(value) {
    return ratingPromptOrDefault(value) !== DEFAULT_RATING_PROMPT;
  }

  async function refreshSettings() {
    if (!api.getSettings) return null;
    try {
      const settings = await api.getSettings();
      loadSettingsToSidePanel(settings);
      return settings;
    } catch (error) {
      showSettingsToast(error.message || String(error), { error: true, duration: 5000 });
      return null;
    }
  }

  function collectSidePanelSettings() {
    const pageCallPhoneAndVipChecks = checkedValuesByDataKey('.s-bhp-vipf-cb');
    const vipRadioValues = valuesByDataKey('.s-bhp-vipf-radio');
    return {
      run_time_limit_minutes: Number($('s-run-time-limit-minutes')?.value || 15),
      age_max: Number($('s-age-max')?.value || 30),
      school_filter_enabled: Boolean($('s-school-enabled')?.checked),
      schools: $('s-schools')?.value || '',
      company_filter_enabled: Boolean($('s-company-enabled')?.checked),
      companies: $('s-companies')?.value || '',
      proactive_screening: {
        age_max: Number($('s-pro-age-max')?.value || 30),
        school_filter_enabled: Boolean($('s-pro-school-enabled')?.checked),
        schools: $('s-pro-schools')?.value || '',
        company_filter_enabled: Boolean($('s-pro-company-enabled')?.checked),
        companies: $('s-pro-companies')?.value || '',
        followup_msg: $('s-pro-followup-msg')?.value || '',
        page_filters: {
          edu: checkedValues('.s-pf-edu-cb'),
          intention: checkedValues('.s-pf-intention-cb'),
          salary: $('s-pf-salary')?.value || '',
          experience: checkedValues('.s-pf-exp-cb'),
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
        greeting: $('s-msg-greeting')?.value || '',
        thank: $('s-msg-thank')?.value || '',
        contact: $('s-msg-contact')?.value || '',
        contact_no_wechat: $('s-msg-contact-no-wechat')?.value || '',
        job_closed: $('s-msg-job-closed')?.value || '',
        thank_on_fail_enabled: Boolean($('s-thank-on-fail-enabled')?.checked),
        invite_on_pass_enabled: Boolean($('s-invite-on-pass-enabled')?.checked),
        reply_mode: $('s-reply-mode-reply')?.checked ? 'reply' : 'wechat',
        exchange_wechat_enabled: Boolean($('s-exchange-wechat-enabled')?.checked)
      },
      contact_grades: checkedValues('.s-grade-cb'),
      rating_prompt: ratingPromptOrDefault($('s-rating-prompt')?.value),
      byo: {
        enabled: true,
        url: $('s-byo-url')?.value || '',
        key: $('s-byo-key')?.value || '',
        model: $('s-byo-model')?.value || '',
        advanced: {
          force_protocol: radioValue('s-byo-force-protocol', 'auto'),
          headers: $('s-byo-headers')?.value || '',
          pdf_mode: radioValue('s-byo-pdf-mode', 'auto'),
          skip_probe: Boolean($('s-byo-skip-probe')?.checked)
        }
      },
      auto_download_log: Boolean($('s-auto-download-log')?.checked),
      debug_enabled: Boolean($('s-debug-enabled')?.checked)
    };
  }

  function bindActions() {
    for (const button of all('.preset-btn')) {
      button.addEventListener?.('click', () => {
        const schoolPreset = button.getAttribute?.('data-preset');
        const companyPreset = button.getAttribute?.('data-company');
        const proSchoolPreset = button.getAttribute?.('data-pro-preset');
        const proCompanyPreset = button.getAttribute?.('data-pro-company');
        if (schoolPreset) appendPresetLines('s-schools', SCHOOL_PRESETS[schoolPreset] || []);
        if (companyPreset) appendPresetLines('s-companies', COMPANY_PRESETS[companyPreset] || []);
        if (proSchoolPreset) appendPresetLines('s-pro-schools', SCHOOL_PRESETS[proSchoolPreset] || []);
        if (proCompanyPreset) appendPresetLines('s-pro-companies', COMPANY_PRESETS[proCompanyPreset] || []);
      });
    }
    $('s-run-time-limit-minutes')?.addEventListener('input', syncRunTimeLimitLabel);
    $('s-run-time-limit-minutes')?.addEventListener('change', syncRunTimeLimitLabel);

    const setActionGroupOpen = (groupName, open) => {
      const group = ACTION_GROUPS[groupName];
      if (!group) return;
      const panel = $(group.panel);
      const button = $(group.button);
      panel?.classList.toggle('show', open);
      button?.classList.toggle('expanded', open);
      button?.setAttribute?.('aria-expanded', open ? 'true' : 'false');
    };

    const toggleActionGroup = (groupName) => {
      const group = ACTION_GROUPS[groupName];
      const currentlyOpen = $(group?.panel)?.classList.contains('show');
      for (const name of Object.keys(ACTION_GROUPS)) setActionGroupOpen(name, false);
      setActionGroupOpen(groupName, !currentlyOpen);
    };

    const selectSubAction = (buttonId, mode, subMode) => {
      for (const id of START_ACTION_IDS) removeClass(id, 'active');
      addClass(buttonId, 'active');
      addClass(ACTION_GROUPS[mode]?.button, 'expanded');
      const label = ACTION_GROUPS[mode]?.options?.[subMode] || ACTION_GROUPS[mode]?.title || '自动化';
      setText('run-mode-title', `启动中：${label}`);
      setText('run-mode-subtitle', '已收到操作指令，正在请求后台启动任务。');
      show('status-card', true);
      setText('status', `正在启动：${label}`);
    };

    $('btn-follow')?.addEventListener('click', () => toggleActionGroup('follow'));
    $('btn-proactive')?.addEventListener('click', () => toggleActionGroup('proactive'));

    const start = async (mode, subMode, buttonId) => {
      const groupTitle = ACTION_GROUPS[mode]?.title || '自动化';
      const optionTitle = ACTION_GROUPS[mode]?.options?.[subMode] || '';
      selectSubAction(buttonId, mode, subMode);
      appendLog(`${groupTitle}${optionTitle ? ` · ${optionTitle}` : ''}启动中`, 'info');
      const settings = await refreshSettings();
      if (!isByoConfigured(settings)) {
        for (const id of START_ACTION_IDS) removeClass(id, 'active');
        setText('run-mode-title', '需要配置自定义 AI');
        setText('run-mode-subtitle', '自动处理需要先配置 Base URL、API Key 和 Model。');
        setText('status', '请先配置自定义 AI');
        showByoSetupModal('开始自动处理前，请先配置自定义 AI。AI 评级和话术生成只会调用你填写的 API，不会使用内置服务。');
        appendLog('请先配置自定义 AI', 'fail');
        return;
      }
      try {
        await api.startAuto(mode, subMode);
        appendLog(`${groupTitle}${optionTitle ? ` · ${optionTitle}` : ''}已启动`, 'done');
        await refreshStatus();
      } catch (error) {
        setText('run-mode-title', `${groupTitle}启动失败`);
        setText('run-mode-subtitle', error.message || String(error));
        setText('status', error.message || String(error));
        appendLog(error.message || String(error), 'fail');
      }
    };
    $('btn-new')?.addEventListener('click', () => start('follow', 'new', 'btn-new'));
    $('btn-chat')?.addEventListener('click', () => start('follow', 'chat', 'btn-chat'));
    $('btn-smart')?.addEventListener('click', () => start('follow', 'smart', 'btn-smart'));
    $('btn-pro-followup')?.addEventListener('click', () => start('proactive', 'followup', 'btn-pro-followup'));
    $('btn-pro-greet')?.addEventListener('click', () => start('proactive', 'greet', 'btn-pro-greet'));
    $('btn-pro-smart')?.addEventListener('click', () => start('proactive', 'smart', 'btn-pro-smart'));
    $('btn-stop')?.addEventListener('click', async () => {
      await api.stopAuto();
      appendLog('已请求暂停', 'done');
      await refreshStatus();
    });
    $('pause-resume-btn')?.addEventListener('click', async () => {
      try {
        await api.resumeAuto();
        root.BHPPauseUi?.hide?.();
        appendLog('已继续暂停任务', 'done');
        await refreshStatus();
      } catch (error) {
        appendLog(error.message || String(error), 'fail');
        await refreshStatus();
      }
    });
    $('pause-clear-btn')?.addEventListener('click', async () => {
      try {
        await api.clearPauseState();
        root.BHPPauseUi?.hide?.();
        appendLog('已放弃暂停任务', 'done');
        await refreshStatus();
      } catch (error) {
        appendLog(error.message || String(error), 'fail');
      }
    });
    const saveSidePanelSettings = async (settings) => {
      try {
        await api.saveSettings(settings);
        showSettingsToast('已保存');
      } catch (error) {
        showSettingsToast(error.message || String(error), { error: true, duration: 5000 });
      }
    };
    $('btn-save-settings')?.addEventListener('click', async () => {
      const settings = collectSidePanelSettings();
      if (hasCustomRatingPrompt(settings.rating_prompt)) {
        showTemplateModal({
          title: '确认修改评级 Prompt',
          body: '默认评级 Prompt 会要求 AI 严格返回 JSON。修改后必须仍然要求返回 {"rating":"A/B/C/D","summary":"...","risk":"..."}，否则评级结果可能无法解析。',
          primaryText: '仍然保存',
          secondaryText: '取消',
          onPrimary: async () => {
            closeTemplateModal();
            await saveSidePanelSettings(settings);
          }
        });
        return;
      }
      await saveSidePanelSettings(settings);
    });
    $('s-rating-prompt-reset')?.addEventListener('click', () => {
      setValue('s-rating-prompt', DEFAULT_RATING_PROMPT);
      showSettingsToast('已恢复默认评级 Prompt');
    });
    $('settings-export-btn')?.addEventListener('click', () => {
      try {
        const settings = collectSidePanelSettings();
        const BlobCtor = root.Blob || globalThis.Blob;
        const URLApi = root.URL || globalThis.URL;
        if (!BlobCtor || !URLApi?.createObjectURL) throw new Error('当前环境不支持导出');
        const blob = new BlobCtor([JSON.stringify(settings, null, 2)], { type: 'application/json' });
        const url = URLApi.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `recruiting-settings-${new Date().toISOString().slice(0, 10)}.json`;
        link.click?.();
        setTimeout(() => URLApi.revokeObjectURL?.(url), 1000);
        showSettingsToast('已导出设置');
      } catch (error) {
        showSettingsToast(error.message || String(error), { error: true, duration: 5000 });
      }
    });
    $('s-byo-test-btn')?.addEventListener('click', async () => {
      const result = $('s-byo-test-result');
      const detail = $('s-byo-test-detail');
      try {
        const url = $('s-byo-url')?.value || '';
        await api.requestByoPermission(url);
        const probe = await api.testByo({
          url,
          key: $('s-byo-key')?.value || '',
          model: $('s-byo-model')?.value || ''
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
  }

  function stripFence(text) {
    return String(text || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  }

  function pickText(obj, keys) {
    for (const key of keys) {
      const value = obj?.[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
  }

  function parseTemplatePayload(text) {
    const cleaned = stripFence(text);
    let obj = null;
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) obj = JSON.parse(jsonMatch[0]);
    else obj = JSON.parse(cleaned);
    return {
      greeting: pickText(obj, ['greeting', 'first_greeting', 'hello']),
      thank: pickText(obj, ['thank', 'thanks', 'reject', 'fail_thank']),
      contact: pickText(obj, ['contact', 'wechat', 'invite_wechat']),
      contact_no_wechat: pickText(obj, ['contact_no_wechat', 'reply', 'invite_reply']),
      job_closed: pickText(obj, ['job_closed', 'closed', 'position_closed']),
      proactive_followup: pickText(obj, ['proactive_followup', 'followup', 'pro_followup'])
    };
  }

  function applyGeneratedTemplates(templates) {
    let count = 0;
    for (const [key, id] of Object.entries(TEMPLATE_FIELDS)) {
      if (!templates[key]) continue;
      setValue(id, templates[key]);
      count += 1;
    }
    return count;
  }

  function showTemplateModal({ title, body, primaryText = '去配置', secondaryText = '关闭', onPrimary, onSecondary }) {
    setText('ai-template-modal-title', title);
    setText('ai-template-modal-body', body);
    setText('ai-template-primary', primaryText);
    setText('ai-template-secondary', secondaryText);
    const modal = $('ai-template-modal');
    if (modal) modal.style.display = 'flex';
    const primary = $('ai-template-primary');
    if (primary) primary.onclick = onPrimary || closeTemplateModal;
    const secondary = $('ai-template-secondary');
    if (secondary) secondary.onclick = onSecondary || closeTemplateModal;
  }

  function closeTemplateModal() {
    show('ai-template-modal', false);
  }

  function focusByoSection() {
    closeTemplateModal();
    $('s-byo-section')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
      const target = $('s-byo-url');
      target?.focus?.();
    }, 180);
  }

  function showByoSetupModal(body = 'AI 生成话术只会调用你填写的自定义 AI。请先填写 Base URL、API Key 和 Model，并完成授权。') {
    showTemplateModal({
      title: '需要先配置自定义 AI',
      body,
      primaryText: '去配置',
      onPrimary: focusByoSection
    });
  }

  function bindTemplateGenerator() {
    $('ai-template-secondary')?.addEventListener('click', closeTemplateModal);
    $('ai-template-modal')?.addEventListener('click', (event) => {
      if (event.target === $('ai-template-modal')) closeTemplateModal();
    });
    $('s-message-ai-generate')?.addEventListener('click', async () => {
      const button = $('s-message-ai-generate');
      const currentSettings = collectSidePanelSettings();
      if (!isByoConfigured(currentSettings)) {
        showByoSetupModal();
        return;
      }

      try {
        if (button) {
          button.disabled = true;
          button.textContent = '生成中';
        }
        showSettingsToast('正在生成话术', { duration: 0 });
        await api.requestByoPermission(currentSettings.byo.url);
        const result = await api.generateMessageTemplates(currentSettings);
        const count = applyGeneratedTemplates(parseTemplatePayload(result?.text || ''));
        if (!count) throw new Error('AI 未返回可用的话术字段');
        showSettingsToast('已生成话术，请检查后保存');
      } catch (error) {
        showSettingsToast(error.message || String(error), { error: true, duration: 5000 });
        showTemplateModal({
          title: 'AI 生成失败',
          body: error.message || String(error),
          primaryText: '关闭',
          onPrimary: closeTemplateModal
        });
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = 'AI 生成';
        }
      }
    });
  }

  function bindVipFilterRefresh() {
    $('s-vip_filters_refresh')?.addEventListener('click', async () => {
      const button = $('s-vip_filters_refresh');
      const originalText = button?.textContent || '刷新岗位';
      try {
        if (button) {
          button.disabled = true;
          button.textContent = '采集中...';
        }
        setText('s-vip_filters_hint', '正在从推荐牛人页采集...');
        const result = await api.byType('EXTRACT_VIP_FILTERS', {});
        const schema = result?.schema || result || {};
        const dynamicOptions = result?.dynamicOptions || dynamicOptionsFromSchema(schema);
        const currentSettings = collectSidePanelSettings();
        renderVipDynamicOptions(dynamicOptions, currentSettings.proactive_screening?.vip_filters || {});
        const groupCount = Array.isArray(schema.groups) ? schema.groups.length : 0;
        const ts = schema.ts || dynamicOptions.updated_at || Date.now();
        setText('s-vip_filters_hint', `已采集 ${groupCount} 个筛选组（${new Date(ts).toLocaleTimeString()}）`);
      } catch (error) {
        setText('s-vip_filters_hint', `采集失败：${error.message || String(error)}`);
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = originalText;
        }
      }
    });
  }

  function renderNetLogEntries(entries = []) {
    const list = $('netlog-list');
    const info = $('netlog-info');
    if (!list) return;
    const rows = Array.isArray(entries) ? entries : [];
    if (info) info.textContent = rows.length ? `已加载 ${rows.length} 条 BOSS API 请求记录` : '暂无网络日志';
    if (!rows.length) {
      list.style.display = 'none';
      list.innerHTML = '';
      return;
    }
    list.style.display = '';
    list.innerHTML = rows.map((entry) => {
      const tone = entry._logout || Number(entry.status) >= 400 ? 'fail' : 'done';
      const status = entry.status == null ? '-' : entry.status;
      const duration = entry.duration == null ? '' : ` ${entry.duration}ms`;
      return [
        '<div class="netlog-entry">',
        `<span class="log-ts">${escapeHtml(entry.ts || '')}</span>`,
        `<span class="log-${tone}">${escapeHtml(entry.method || 'GET')} ${escapeHtml(status)}</span>`,
        `<span class="run-type">${escapeHtml(duration)}</span>`,
        `<div class="log-rating-detail">${escapeHtml(entry.url || '')}</div>`,
        entry.reqBody ? `<pre class="log-rating-detail">${escapeHtml(entry.reqBody)}</pre>` : '',
        '</div>'
      ].join('');
    }).join('');
  }

  function bindNetLogControls() {
    $('btn-netlog-load')?.addEventListener('click', async () => {
      try {
        setText('netlog-info', '正在加载网络日志...');
        renderNetLogEntries(await api.byType('GET_NET_LOG', {}));
      } catch (error) {
        setText('netlog-info', `加载失败：${error.message || String(error)}`);
      }
    });
    $('btn-netlog-clear')?.addEventListener('click', async () => {
      try {
        await api.byType('CLEAR_NET_LOG', {});
        renderNetLogEntries([]);
        setText('netlog-info', '网络日志已清除');
      } catch (error) {
        setText('netlog-info', `清除失败：${error.message || String(error)}`);
      }
    });
  }

  function snifferPayload() {
    const maxDepth = Number.parseInt($('sniffer-depth')?.value || '8', 10);
    const maxRoots = Number.parseInt($('sniffer-max-roots')?.value || '0', 10);
    return {
      rootSelector: String($('sniffer-root')?.value || '').trim() || 'body',
      urlSubstring: String($('sniffer-target')?.value || '').trim(),
      maxDepth: Number.isFinite(maxDepth) && maxDepth > 0 ? maxDepth : 8,
      maxRoots: Number.isFinite(maxRoots) && maxRoots >= 0 ? maxRoots : 0,
      stripEmpty: Boolean($('sniffer-strip')?.checked)
    };
  }

  function setSnifferStatus(message) {
    const el = $('sniffer-status');
    if (el) el.textContent = message || '';
  }

  function bindSnifferControls() {
    $('sniffer-preset-filters')?.addEventListener('click', () => {
      setValue('sniffer-root', '.vip-filters-wrap, .filter-wrap');
      setValue('sniffer-target', 'recommend');
      setValue('sniffer-depth', '8');
      setValue('sniffer-max-roots', '0');
    });
    $('sniffer-preset-cards')?.addEventListener('click', () => {
      setValue('sniffer-root', '.candidate-card-wrap');
      setValue('sniffer-target', 'recommend');
      setValue('sniffer-depth', '10');
      setValue('sniffer-max-roots', '1');
    });
    $('sniffer-clear')?.addEventListener('click', () => {
      setValue('sniffer-output', '');
      setSnifferStatus('');
    });
    $('sniffer-copy')?.addEventListener('click', async () => {
      const output = $('sniffer-output');
      if (!output?.value) return;
      try {
        const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : null;
        await clipboard?.writeText?.(output.value);
        setSnifferStatus('已复制到剪贴板');
      } catch (error) {
        try {
          output.select?.();
          document.execCommand?.('copy');
          setSnifferStatus('已复制');
        } catch (_) {
          setSnifferStatus('复制失败');
        }
      }
    });
    $('sniffer-run')?.addEventListener('click', async () => {
      const button = $('sniffer-run');
      try {
        if (button) button.disabled = true;
        setSnifferStatus('嗅探中...');
        const result = await api.byType('SNIFF_DOM', snifferPayload());
        const results = Array.isArray(result?.results) ? result.results : [];
        setValue('sniffer-output', JSON.stringify(results, null, 2));
        const nodeCount = results.reduce((sum, item) => sum + (Array.isArray(item.nodes) ? item.nodes.length : 0), 0);
        setSnifferStatus(`完成：${results.length} 个 frame，${nodeCount} 个匹配根节点`);
      } catch (error) {
        setValue('sniffer-output', '');
        setSnifferStatus(`失败：${error.message || String(error)}`);
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  function bindDebugControls() {
    let paused = false;
    $('btn-debug-pause')?.addEventListener('click', () => {
      paused = !paused;
      setText('btn-debug-pause', paused ? '继续' : '暂停');
    });
    $('btn-debug-clear')?.addEventListener('click', async () => {
      const log = $('debug-log');
      if (log) log.innerHTML = '';
      try {
        await api.byType('DEBUG_CMD', { method: 'clear_debug_log' });
      } catch (error) {
        // Debug cleanup is best-effort.
      }
    });
    api.on('DEBUG_LOG', (payload = {}) => {
      if (paused) return;
      const log = $('debug-log');
      if (!log) return;
      const row = document.createElement('div');
      row.innerHTML = `<span class="log-ts">${escapeHtml(payload.time || '')}</span> ${escapeHtml(payload.text || payload.message || '')}`;
      log.appendChild(row);
    });
  }

  function bindDiagnosticsControls() {
    bindVipFilterRefresh();
    bindNetLogControls();
    bindSnifferControls();
    bindDebugControls();
    $('s-debug-enabled')?.addEventListener('change', (event) => {
      setDiagnosticsVisible(Boolean(event?.target?.checked ?? $('s-debug-enabled')?.checked));
    });
  }

  function bindRuntimeMessages() {
    api.on('AUTO_PROGRESS', (payload = {}) => {
      const snapshot = payload.snapshot || {};
      applyAutomationSnapshot({ running: snapshot.running !== false, ...snapshot });
      if (payload.text) {
        setText('status', payload.text);
        appendLog(payload.text, 'info');
      }
    });
    api.on('AUTO_STATS', (payload = {}) => {
      if (payload.text) setText('status-run-limit', payload.text);
      if (payload.snapshot) updateStats(payload.snapshot);
    });
    api.on('AUTO_RATING', (payload = {}) => {
      appendLog(`${payload.candidateName || payload.name || '候选人'} ${payload.rating || ''}`.trim(), 'info');
    });
    api.on('AUTO_STOPPED', (payload = {}) => {
      setRunning(false);
      const reason = payload.reason || '已停止';
      setText('status', reason);
      appendLog(reason, 'done');
      refreshStatus();
    });
    api.on('AUTO_PAUSED', (payload = {}) => {
      setRunning(false);
      applyPauseState({ ...(payload.pauseState || {}), paused: true });
      appendLog(payload.reason || '已暂停', 'done');
    });
    api.on('AUTO_ERROR', (payload = {}) => {
      setRunning(false);
      const message = payload.message || '自动化异常';
      setText('status', message);
      appendLog(message, 'fail');
    });
    api.on('BOSS_STATUS_CHANGED', (payload = {}) => {
      refreshStatus();
    });
  }

  function bindTheme() {
    const toggle = $('theme-toggle');
    const syncThemeControl = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setText('theme-label', isDark ? '深色' : '明亮');
      toggle?.setAttribute?.('aria-pressed', isDark ? 'true' : 'false');
      toggle?.setAttribute?.('title', isDark ? '切换到明亮模式' : '切换到深色模式');
    };
    syncThemeControl();
    toggle?.addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
      syncThemeControl();
      try {
        localStorage.setItem('bhp.theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
      } catch (error) {
        // Ignore.
      }
    });
  }

  function bindLogScrollPassthrough() {
    const log = $('log');
    if (!log?.addEventListener) return;
    log.addEventListener('wheel', (event) => {
      const delta = Number(event.deltaY || 0);
      if (!delta) return;
      const maxScroll = Math.max(0, Number(log.scrollHeight || 0) - Number(log.clientHeight || 0));
      if (!maxScroll) return;
      const atTop = log.scrollTop <= 0;
      const atBottom = log.scrollTop >= maxScroll - 1;
      if ((delta < 0 && atTop) || (delta > 0 && atBottom)) {
        const scroller = document.scrollingElement || document.documentElement || document.body;
        if (scroller?.scrollBy) scroller.scrollBy({ top: delta });
        else if (scroller && typeof scroller.scrollTop === 'number') scroller.scrollTop += delta;
        event.preventDefault?.();
      }
    }, { passive: false });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindTheme();
    bindSettingsOverlay();
    bindActions();
    bindDetailOverlay();
    bindTemplateGenerator();
    bindDiagnosticsControls();
    bindRuntimeMessages();
    bindLogScrollPassthrough();
    refreshSettings();
    refreshStatus();
  });
})(window);
