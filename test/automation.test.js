const test = require('node:test');
const assert = require('node:assert/strict');

const { createAutomation } = require('../src/modules/automation.js');
const settingsModule = require('../src/modules/settings.js');
const filters = require('../src/modules/filters.js');
const messaging = require('../src/modules/messaging.js');

function createStorageStub(usage = {}) {
  const state = {
    dailyUsage: {
      date: '2026-06-10',
      follow_runs: 0,
      proactive_runs: 0,
      proactive_resume_views: 0,
      ...usage
    },
    runState: null,
    pauseState: null,
    history: []
  };
  return {
    state,
    canOpenProactiveResume() {
      return true;
    },
    async getDailyUsage() {
      return { ...state.dailyUsage };
    },
    async incrementDailyUsage(field, amount = 1) {
      state.dailyUsage[field] = Number(state.dailyUsage[field] || 0) + amount;
      return { ...state.dailyUsage };
    },
    async getRunState() {
      return state.runState;
    },
    async saveRunState(runState) {
      state.runState = runState;
      return runState;
    },
    async getPauseState() {
      return state.pauseState;
    },
    async savePauseState(pauseState) {
      state.pauseState = pauseState;
      return pauseState;
    },
    async clearPauseState() {
      state.pauseState = null;
      return true;
    },
    async appendRunHistory(entry) {
      state.history.push(entry);
      return state.history;
    }
  };
}

test('automation records business failure separately and may send thank message', async () => {
  const sent = [];
  const reports = [];
  const storage = createStorageStub();
  const settings = settingsModule.mergeSettings({
    school_filter_enabled: true,
    schools: ['清华'],
    messages: {
      thank_on_fail_enabled: true,
      thank: '感谢 {候选人姓名} 关注，{评级摘要}'
    }
  });
  const automation = createAutomation({
    settingsProvider: async () => settings,
    storage,
    filters,
    messaging,
    aiRating: {
      analyzeResume: async () => {
        throw new Error('AI should not run');
      }
    },
    browserOps: {
      scanCandidates: async () => [{ id: 'c1', candidate_name: '张三', age: 24, school: '普通本科', company: '小公司' }],
      sendCandidateMessage: async (candidate, decision) => {
        sent.push({ candidate, decision });
        return { sent: true };
      }
    },
    reporter: (event) => reports.push(event)
  });

  assert.equal(await automation.start({ mode: 'follow', subMode: 'new' }), 'started');
  await automation.waitForIdle();

  assert.equal(sent.length, 1);
  assert.equal(sent[0].decision.action, 'thank');
  assert.match(sent[0].decision.message, /感谢 张三 关注/);
  assert.equal(storage.state.runState.checkpoint.level, 'list');
  assert.deepEqual(storage.state.runState.processedIds, ['c1']);
  assert.equal(storage.state.runState.stats.businessFailed, 1);
  assert.equal(reports.some((event) => event.type === 'AUTO_PROGRESS'), true);
});

test('automation restores running list-level checkpoint and skips processed candidates', async () => {
  const storage = createStorageStub();
  storage.state.runState = {
    running: true,
    mode: 'follow',
    subMode: 'new',
    startedAt: '2026-06-10T00:00:00.000Z',
    lastText: '智能跟进运行中',
    checkpoint: {
      level: 'list',
      mode: 'follow',
      subMode: 'new',
      cursor: 1
    },
    processedIds: ['c1'],
    candidateActions: {
      c1: { rated: true, rating: 'A', messageAction: 'reply' }
    },
    processLog: [
      { time: '2026-06-10T00:00:10.000Z', kind: 'rated', candidateId: 'c1', text: 'A' }
    ],
    ratingResults: [
      { candidateId: 'c1', candidateName: '赵一', rating: 'A', summary: 'ok' }
    ],
    stats: {
      processed: 1,
      rated: 1,
      replied: 1,
      greeted: 0,
      businessFailed: 0,
      systemFailed: 0,
      skipped: 0
    }
  };
  const captured = [];
  const automation = createAutomation({
    now: () => new Date('2026-06-10T00:01:00.000Z'),
    settingsProvider: async () => settingsModule.mergeSettings(),
    storage,
    filters,
    messaging,
    aiRating: {
      analyzeResume: async () => ({ rating: 'B', summary: 'ok', risk: '' })
    },
    browserOps: {
      scanCandidates: async () => [
        { id: 'c1', candidate_name: '赵一', age: 24, school: '清华', company: '腾讯' },
        { id: 'c2', candidate_name: '赵二', age: 25, school: '清华', company: '腾讯' }
      ],
      captureResume: async (candidate) => {
        captured.push(candidate.id);
        return { ...candidate, resumeText: 'ok' };
      },
      sendCandidateMessage: async () => ({ sent: true })
    }
  });

  await automation.start({ mode: 'follow', subMode: 'new' });
  await automation.waitForIdle();

  assert.deepEqual(captured, ['c2']);
  assert.deepEqual(storage.state.runState.processedIds, ['c1', 'c2']);
  assert.deepEqual(storage.state.runState.candidateActions.c1, { rated: true, rating: 'A', messageAction: 'reply' });
  assert.equal(storage.state.runState.stats.processed, 2);
  assert.equal(storage.state.runState.stats.rated, 2);
  assert.equal(storage.state.runState.processLog.some((entry) => entry.candidateId === 'c1'), true);
});

test('automation emits AUTO_RATING for each successful rating', async () => {
  const reports = [];
  const storage = createStorageStub();
  const automation = createAutomation({
    settingsProvider: async () => settingsModule.mergeSettings(),
    storage,
    filters,
    messaging,
    aiRating: {
      analyzeResume: async () => ({ rating: 'A', summary: '技术匹配', risk: '无明显风险' })
    },
    browserOps: {
      scanCandidates: async () => [{ id: 'c1', candidate_name: '钱七', age: 24, school: '清华', company: '腾讯' }],
      captureResume: async (candidate) => ({ ...candidate, resumeText: 'ok' }),
      sendCandidateMessage: async () => ({ sent: true })
    },
    reporter: (event) => reports.push(event)
  });

  await automation.start({ mode: 'follow', subMode: 'new' });
  await automation.waitForIdle();

  const ratingEvent = reports.find((event) => event.type === 'AUTO_RATING');
  assert.ok(ratingEvent);
  assert.deepEqual(ratingEvent.payload, {
    candidateId: 'c1',
    candidateName: '钱七',
    name: '钱七',
    rating: 'A',
    summary: '技术匹配',
    risk: '无明显风险'
  });
});

test('automation downloads run log when auto_download_log is enabled', async () => {
  const storage = createStorageStub();
  const downloads = [];
  const automation = createAutomation({
    now: () => new Date('2026-06-10T00:00:00.000Z'),
    settingsProvider: async () => settingsModule.mergeSettings({ auto_download_log: true }),
    storage,
    filters,
    messaging,
    aiRating: {
      analyzeResume: async () => ({ rating: 'A', summary: '技术匹配', risk: '' })
    },
    browserOps: {
      scanCandidates: async () => [{ id: 'c1', candidate_name: '孙八', age: 24, school: '清华', company: '腾讯' }],
      captureResume: async (candidate) => ({ ...candidate, resumeText: 'ok' }),
      sendCandidateMessage: async () => ({ sent: true })
    },
    downloads: {
      download: async (options) => {
        downloads.push(options);
        return 1;
      }
    }
  });

  await automation.start({ mode: 'follow', subMode: 'new' });
  await automation.waitForIdle();

  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].filename, 'bhp-logs/bhp-run-2026-06-10T000000000Z.txt');
  assert.equal(downloads[0].saveAs, false);
  const logText = decodeURIComponent(downloads[0].url.split(',')[1]);
  assert.match(logText, /运行结果：处理完成/);
  assert.match(logText, /孙八/);
  assert.match(logText, /A 技术匹配/);
});

test('automation keeps run completion when log download fails', async () => {
  const reports = [];
  const storage = createStorageStub();
  const automation = createAutomation({
    settingsProvider: async () => settingsModule.mergeSettings({ auto_download_log: true }),
    storage,
    filters,
    messaging,
    aiRating: {
      analyzeResume: async () => ({ rating: 'A', summary: '技术匹配', risk: '' })
    },
    browserOps: {
      scanCandidates: async () => [{ id: 'c1', candidate_name: '周九', age: 24, school: '清华', company: '腾讯' }],
      captureResume: async (candidate) => ({ ...candidate, resumeText: 'ok' }),
      sendCandidateMessage: async () => ({ sent: true })
    },
    downloads: {
      download: async () => {
        throw new Error('download denied');
      }
    },
    reporter: (event) => reports.push(event)
  });

  await automation.start({ mode: 'follow', subMode: 'new' });
  await automation.waitForIdle();

  assert.equal(storage.state.runState.reason, '处理完成');
  assert.equal(reports.some((event) => event.type === 'AUTO_STOPPED' && event.payload.reason === '处理完成'), true);
});

test('automation does not send thank messages for system failures', async () => {
  const sent = [];
  const storage = createStorageStub();
  const settings = settingsModule.mergeSettings({
    messages: {
      thank_on_fail_enabled: true,
      thank: '感谢关注'
    }
  });
  const automation = createAutomation({
    settingsProvider: async () => settings,
    storage,
    filters,
    messaging,
    aiRating: {
      analyzeResume: async () => {
        throw new Error('AI timeout');
      }
    },
    browserOps: {
      scanCandidates: async () => [{ id: 'c1', candidate_name: '李四', age: 24, school: '清华', company: '腾讯' }],
      sendCandidateMessage: async (candidate, decision) => {
        sent.push({ candidate, decision });
      }
    }
  });

  await automation.start({ mode: 'follow', subMode: 'chat' });
  await automation.waitForIdle();

  assert.equal(sent.length, 0);
  assert.equal(storage.state.runState.stats.systemFailed, 1);
  assert.equal(storage.state.runState.processLog[0].kind, 'system_failure');
});

test('automation starts proactive runs when daily online resume counter is above 200', async () => {
  const storage = createStorageStub({ proactive_resume_views: 200 });
  let scanned = false;
  const automation = createAutomation({
    settingsProvider: async () => settingsModule.mergeSettings(),
    storage,
    filters,
    messaging,
    aiRating: { analyzeResume: async () => ({ rating: 'A', summary: '', risk: '' }) },
    browserOps: {
      scanCandidates: async () => {
        scanned = true;
        return [];
      }
    }
  });

  await automation.start({ mode: 'proactive', subMode: 'greet' });
  await automation.waitForIdle();

  assert.equal(scanned, true);
  assert.equal(storage.state.runState.running, false);
  assert.doesNotMatch(storage.state.runState.reason || '', /200/);
});

test('automation continues opening proactive resumes when daily counter passes 200 during a run', async () => {
  const storage = createStorageStub({ proactive_resume_views: 199 });
  const captured = [];
  const automation = createAutomation({
    settingsProvider: async () => settingsModule.mergeSettings(),
    storage,
    filters,
    messaging,
    aiRating: { analyzeResume: async () => ({ rating: 'A', summary: '', risk: '' }) },
    browserOps: {
      scanCandidates: async () => [
        { id: 'c1', candidate_name: '王一', age: 24, school: '清华', company: '腾讯' },
        { id: 'c2', candidate_name: '王二', age: 25, school: '清华', company: '腾讯' }
      ],
      captureResume: async (candidate) => {
        captured.push(candidate.id);
        return { ...candidate, resumeText: 'ok' };
      },
      sendCandidateMessage: async () => ({ sent: true })
    }
  });

  await automation.start({ mode: 'proactive', subMode: 'greet' });
  await automation.waitForIdle();

  assert.deepEqual(captured, ['c1', 'c2']);
  assert.equal(storage.state.dailyUsage.proactive_resume_views, 201);
  assert.deepEqual(storage.state.runState.processedIds, ['c1', 'c2']);
  assert.doesNotMatch(storage.state.runState.reason || '', /200/);
});

test('automation greets proactive recommendation cards after passing AI rating', async () => {
  const storage = createStorageStub();
  const greeted = [];
  const automation = createAutomation({
    settingsProvider: async () => settingsModule.mergeSettings({
      messages: {
        invite_on_pass_enabled: true,
        contact: '你好，方便聊聊吗？',
        reply_mode: 'wechat'
      }
    }),
    storage,
    filters,
    messaging,
    aiRating: { analyzeResume: async () => ({ rating: 'A', summary: '匹配', risk: '' }) },
    browserOps: {
      scanCandidates: async () => [
        { id: 'geek-1', geekId: 'geek-1', source: 'recommend', candidate_name: '王一', age: 24, schools: ['清华'], companies: ['腾讯'], resumeText: '王一 清华 腾讯' }
      ],
      captureResume: async (candidate) => ({ ...candidate, resumeText: candidate.resumeText }),
      greetRecommendCandidate: async (candidate, decision) => {
        greeted.push({ candidate, decision });
        return { sent: true, result: 'ok' };
      },
      sendCandidateMessage: async () => {
        throw new Error('should not use chat editor for proactive greeting');
      }
    }
  });

  await automation.start({ mode: 'proactive', subMode: 'greet' });
  await automation.waitForIdle();

  assert.equal(greeted.length, 1);
  assert.equal(greeted[0].candidate.geekId, 'geek-1');
  assert.equal(greeted[0].decision.action, 'contact');
  assert.equal(storage.state.runState.stats.greeted, 1);
  assert.equal(storage.state.runState.stats.rated, 1);
});

test('automation stops after current candidate when run time limit is reached', async () => {
  let current = new Date('2026-06-10T00:00:00.000Z');
  const storage = createStorageStub();
  const captured = [];
  const automation = createAutomation({
    now: () => current,
    settingsProvider: async () => settingsModule.mergeSettings({ run_time_limit_minutes: 8 }),
    storage,
    filters,
    messaging,
    aiRating: {
      analyzeResume: async () => {
        current = new Date('2026-06-10T00:09:00.000Z');
        return { rating: 'A', summary: '', risk: '' };
      }
    },
    browserOps: {
      scanCandidates: async () => [
        { id: 'c1', candidate_name: '张一', age: 24, school: '清华', company: '腾讯' },
        { id: 'c2', candidate_name: '张二', age: 25, school: '清华', company: '腾讯' }
      ],
      captureResume: async (candidate) => {
        captured.push(candidate.id);
        return { ...candidate, resumeText: 'ok' };
      },
      sendCandidateMessage: async () => ({ sent: true })
    }
  });

  await automation.start({ mode: 'follow', subMode: 'new' });
  await automation.waitForIdle();

  assert.deepEqual(captured, ['c1']);
  assert.deepEqual(storage.state.runState.processedIds, ['c1']);
  assert.match(storage.state.runState.reason, /时长上限/);
});

test('automation pauses on user stop and resumes from saved list state', async () => {
  let current = new Date('2026-06-10T00:00:00.000Z');
  let releaseFirstRating;
  const firstRatingStarted = new Promise((resolve) => {
    releaseFirstRating = resolve;
  });
  let firstRatingResolve;
  const firstRating = new Promise((resolve) => {
    firstRatingResolve = resolve;
  });
  const storage = createStorageStub();
  const captured = [];
  const automation = createAutomation({
    now: () => current,
    settingsProvider: async () => settingsModule.mergeSettings({ run_time_limit_minutes: 8 }),
    storage,
    filters,
    messaging,
    aiRating: {
      analyzeResume: async (resume) => {
        if (resume.id === 'c1') {
          releaseFirstRating();
          await firstRating;
        }
        return { rating: 'A', summary: '', risk: '' };
      }
    },
    browserOps: {
      scanCandidates: async () => [
        { id: 'c1', candidate_name: '张一', age: 24, school: '清华', company: '腾讯' },
        { id: 'c2', candidate_name: '张二', age: 25, school: '清华', company: '腾讯' }
      ],
      captureResume: async (candidate) => {
        captured.push(candidate.id);
        return { ...candidate, resumeText: 'ok' };
      },
      sendCandidateMessage: async () => ({ sent: true })
    }
  });

  await automation.start({ mode: 'follow', subMode: 'new' });
  await firstRatingStarted;
  await automation.stop();
  current = new Date('2026-06-10T00:01:00.000Z');
  firstRatingResolve();
  await automation.waitForIdle();

  assert.deepEqual(captured, ['c1']);
  assert.equal(storage.state.pauseState.mode, 'follow');
  assert.deepEqual(storage.state.pauseState.processedIds, ['c1']);
  assert.match(storage.state.runState.reason, /已暂停/);

  current = new Date('2026-06-10T00:02:00.000Z');
  await automation.resume();
  await automation.waitForIdle();

  assert.deepEqual(captured, ['c1', 'c2']);
  assert.equal(storage.state.pauseState, null);
  assert.deepEqual(storage.state.runState.processedIds, ['c1', 'c2']);
  assert.equal(storage.state.runState.reason, '处理完成');
});
