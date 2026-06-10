(function initAutomationModule(root) {
  'use strict';

  function defaultStats() {
    return {
      processed: 0,
      rated: 0,
      replied: 0,
      greeted: 0,
      businessFailed: 0,
      systemFailed: 0,
      skipped: 0
    };
  }

  function candidateId(candidate, index) {
    return String(candidate?.id || candidate?.uid || candidate?.geekId || candidate?.name || candidate?.candidate_name || `idx:${index}`);
  }

  function event(type, payload = {}) {
    return { type, payload };
  }

  function createAutomation(options = {}) {
    const settingsProvider = options.settingsProvider || root.BHPSettings?.getSettings;
    const storage = options.storage || root.BHPStorage;
    const filters = options.filters || root.BHPFilters;
    const messaging = options.messaging || root.BHPMessaging;
    const aiRating = options.aiRating || root.BHPAiRating?.createAiRating?.();
    const browserOps = options.browserOps || root.BHPBrowserOps?.createBrowserOps?.();
    const downloads = options.downloads || root.chrome?.downloads;
    const reporter = options.reporter || (() => {});
    const now = options.now || (() => new Date());

    const ctx = {
      running: false,
      abort: false,
      mode: '',
      subMode: '',
      startedAt: '',
      stoppedAt: '',
      lastText: '',
      lastStats: '',
      processLog: [],
      ratingResults: [],
      processedIds: [],
      candidateActions: {},
      stats: defaultStats(),
      currentPromise: null
    };

    async function getSettings() {
      if (typeof settingsProvider === 'function') return settingsProvider();
      return root.BHPSettings?.mergeSettings?.({}) || {};
    }

    function report(type, payload = {}) {
      reporter(event(type, payload));
    }

    function requestStop(reason) {
      ctx.abort = true;
      ctx.lastText = reason || '已停止';
      return ctx.lastText;
    }

    function cloneArray(value, limit = 100) {
      return Array.isArray(value) ? value.slice(-limit) : [];
    }

    function normalizeStats(stats) {
      const normalized = defaultStats();
      for (const key of Object.keys(normalized)) {
        const value = Number(stats?.[key]);
        normalized[key] = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
      }
      return normalized;
    }

    function uniqueStrings(values) {
      if (!Array.isArray(values)) return [];
      return Array.from(new Set(values.map((value) => String(value)).filter(Boolean)));
    }

    function plainObject(value) {
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }

    function canRestoreRunState(runState, mode, subMode) {
      if (!runState || runState.running !== true) return false;
      if (runState.checkpoint?.level !== 'list') return false;
      if (runState.mode !== mode) return false;
      if (String(runState.subMode || '') !== String(subMode || '')) return false;
      if (runState.stoppedAt) return false;
      return true;
    }

    async function loadRestorableRunState(mode, subMode) {
      if (!storage?.getRunState) return null;
      const runState = await storage.getRunState();
      return canRestoreRunState(runState, mode, subMode) ? runState : null;
    }

    function restoreFromRunState(runState) {
      ctx.startedAt = runState.startedAt || ctx.startedAt;
      ctx.runDeadline = runState.runDeadline || runState.runLimit?.deadline || '';
      ctx.lastText = runState.lastText || ctx.lastText;
      ctx.lastStats = runState.lastStats || '';
      ctx.processLog = cloneArray(runState.processLog);
      ctx.ratingResults = cloneArray(runState.ratingResults);
      ctx.processedIds = uniqueStrings(runState.processedIds);
      ctx.candidateActions = { ...plainObject(runState.candidateActions) };
      ctx.stats = normalizeStats(runState.stats);
      if (ctx.stats.processed < ctx.processedIds.length) ctx.stats.processed = ctx.processedIds.length;
    }

    function runTimeLimitMs(settings) {
      const minutes = Number(settings?.run_time_limit_minutes || 15);
      const clamped = Math.min(15, Math.max(8, Number.isFinite(minutes) ? minutes : 15));
      return clamped * 60 * 1000;
    }

    function ensureRunDeadline(settings) {
      if (ctx.runDeadline) return;
      const current = now().getTime();
      if (!Number.isFinite(current)) return;
      ctx.runDeadline = new Date(current + runTimeLimitMs(settings)).toISOString();
    }

    function remainingRunMs(settings) {
      ensureRunDeadline(settings);
      const deadline = new Date(ctx.runDeadline || '').getTime();
      const current = now().getTime();
      if (!Number.isFinite(deadline) || !Number.isFinite(current)) return 0;
      return Math.max(0, deadline - current);
    }

    function runTimeLimitReached(settings) {
      ensureRunDeadline(settings);
      const deadline = new Date(ctx.runDeadline || '').getTime();
      const current = now().getTime();
      if (!Number.isFinite(deadline) || !Number.isFinite(current)) return false;
      return current >= deadline;
    }

    function snapshot(extra = {}) {
      const runLimitMinutes = Math.round(runTimeLimitMs(extra.settings || {}) / 60000);
      return {
        running: ctx.running,
        paused: Boolean(ctx.paused),
        mode: ctx.mode,
        subMode: ctx.subMode,
        startedAt: ctx.startedAt,
        runDeadline: ctx.runDeadline || undefined,
        stoppedAt: ctx.stoppedAt || undefined,
        lastText: ctx.lastText,
        lastStats: ctx.lastStats,
        runLimit: ctx.runDeadline ? {
          startedAt: ctx.startedAt,
          deadline: ctx.runDeadline,
          minutes: ctx.runLimitMinutes || runLimitMinutes
        } : undefined,
        checkpoint: {
          level: 'list',
          mode: ctx.mode,
          subMode: ctx.subMode,
          cursor: ctx.processedIds.length
        },
        processedIds: ctx.processedIds.slice(),
        candidateActions: { ...ctx.candidateActions },
        processLog: ctx.processLog.slice(-100),
        ratingResults: ctx.ratingResults.slice(-100),
        stats: { ...ctx.stats },
        ...extra
      };
    }

    async function persist(extra = {}) {
      const state = snapshot(extra);
      if (storage?.saveRunState) await storage.saveRunState(state);
      return state;
    }

    async function savePauseState(settings) {
      const remainingMs = Math.max(60000, remainingRunMs(settings));
      const pauseState = {
        ts: now().getTime(),
        ttlMs: storage?.PAUSE_TTL_MS || 15 * 60 * 1000,
        mode: ctx.mode,
        subMode: ctx.subMode,
        remainingMs,
        runLimitMinutes: ctx.runLimitMinutes || Math.round(runTimeLimitMs(settings) / 60000),
        startedAt: ctx.startedAt,
        runDeadline: ctx.runDeadline,
        stats: { ...ctx.stats },
        ratingResults: cloneArray(ctx.ratingResults),
        processLog: cloneArray(ctx.processLog),
        processedIds: ctx.processedIds.slice(),
        candidateActions: { ...ctx.candidateActions },
        lastText: ctx.lastText,
        lastStats: ctx.lastStats
      };
      if (storage?.savePauseState) return storage.savePauseState(pauseState);
      return pauseState;
    }

    async function clearPauseState() {
      if (storage?.clearPauseState) await storage.clearPauseState();
    }

    function restoreFromPauseState(pauseState) {
      ctx.mode = pauseState.mode === 'proactive' ? 'proactive' : 'follow';
      ctx.subMode = String(pauseState.subMode || '');
      ctx.startedAt = pauseState.startedAt || now().toISOString();
      ctx.stoppedAt = '';
      ctx.lastText = '继续中...';
      ctx.lastStats = pauseState.lastStats || '';
      ctx.processLog = cloneArray(pauseState.processLog);
      ctx.ratingResults = cloneArray(pauseState.ratingResults);
      ctx.processedIds = uniqueStrings(pauseState.processedIds);
      ctx.candidateActions = { ...plainObject(pauseState.candidateActions) };
      ctx.stats = normalizeStats(pauseState.stats);
      ctx.runLimitMinutes = Number(pauseState.runLimitMinutes || 15);
      ctx.runDeadline = new Date(now().getTime() + Math.max(60000, Number(pauseState.remainingMs || 0))).toISOString();
      ctx.pauseRequested = false;
      ctx.paused = false;
      ctx.abort = false;
    }

    function log(kind, candidate, text, extra = {}) {
      const entry = {
        time: now().toISOString(),
        kind,
        candidateId: candidate ? candidateId(candidate, ctx.processedIds.length) : '',
        candidateName: candidate?.candidate_name || candidate?.name || '',
        text,
        ...extra
      };
      ctx.processLog.unshift(entry);
      return entry;
    }

    function kindLabel(kind) {
      const labels = {
        business_failure: '业务不通过',
        system_failure: '系统失败',
        rated: '已评级',
        sent: '已发送',
        skipped: '已跳过'
      };
      return labels[kind] || '记录';
    }

    function formatRunLog(reason) {
      const stats = ctx.stats;
      const lines = [
        '招聘助手处理日志',
        `运行结果：${reason || ctx.lastText || ''}`,
        `模式：${ctx.mode || '-'} / ${ctx.subMode || '-'}`,
        `开始：${ctx.startedAt || '-'}`,
        `结束：${ctx.stoppedAt || '-'}`,
        `统计：处理 ${stats.processed}，评级 ${stats.rated}，发送 ${stats.greeted + stats.replied}，业务不通过 ${stats.businessFailed}，系统失败 ${stats.systemFailed}，跳过 ${stats.skipped}`,
        '',
        '候选人记录：'
      ];
      for (const entry of ctx.processLog.slice().reverse()) {
        const time = entry.time || '';
        const name = entry.candidateName || entry.candidateId || '候选人';
        lines.push(`[${time}] ${kindLabel(entry.kind)} ${name} ${entry.text || ''}`.trim());
      }
      return `${lines.join('\n')}\n`;
    }

    async function maybeDownloadRunLog(settings, reason) {
      if (!settings?.auto_download_log || !downloads?.download) return;
      const timestamp = (ctx.stoppedAt || now().toISOString()).replace(/[:.]/g, '');
      const text = formatRunLog(reason);
      try {
        await downloads.download({
          url: `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`,
          filename: `bhp-logs/bhp-run-${timestamp}.txt`,
          saveAs: false,
          conflictAction: 'uniquify'
        });
      } catch (error) {
        const message = `日志下载失败：${error.message || String(error)}`;
        log('system_failure', null, message);
        await persist({ reason: ctx.lastText, logDownloadError: message });
        report('AUTO_ERROR', { message });
      }
    }

    async function sendDecision(candidate, decision) {
      if (!decision || decision.action === 'skip') {
        ctx.stats.skipped += 1;
        return;
      }
      if (ctx.mode === 'proactive') {
        if ((decision.action === 'contact' || decision.action === 'reply') && browserOps?.greetRecommendCandidate) {
          const result = await browserOps.greetRecommendCandidate(candidate, decision);
          if (result?.sent || result?.result === 'ok') {
            ctx.stats.greeted += 1;
            return;
          }
          throw new Error(`推荐列表打招呼失败：${result?.result || result?.reason || 'unknown'}`);
        }
        ctx.stats.skipped += 1;
        return;
      }
      if (browserOps?.sendCandidateMessage) {
        await browserOps.sendCandidateMessage(candidate, decision);
      }
      if (decision.action === 'contact') ctx.stats.greeted += 1;
      else ctx.stats.replied += 1;
    }

    async function processCandidate(candidate, index, settings) {
      if (ctx.abort) return;
      const id = candidateId(candidate, index);
      if (ctx.processedIds.includes(id)) return;

      const filterResult = ctx.mode === 'proactive'
        ? filters.evaluateProactiveCandidate(candidate, settings)
        : filters.evaluateCandidate(candidate, settings);

      if (!filterResult.passed) {
        ctx.stats.businessFailed += 1;
        const decision = messaging.decideMessageForBusinessFailure({
          reason: filterResult.reason,
          candidate
        }, settings);
        await sendDecision(candidate, decision);
        ctx.candidateActions[id] = { businessFailed: true, reason: filterResult.reason, messageAction: decision.action };
        log('business_failure', candidate, filterResult.reason);
        ctx.processedIds.push(id);
        ctx.stats.processed += 1;
        await persist();
        return;
      }

      try {
        const resumeData = browserOps?.captureResume
          ? await browserOps.captureResume(candidate)
          : { ...candidate, resumeText: candidate.resumeText || candidate.resume_text || '' };
        if (ctx.mode === 'proactive' && storage?.incrementDailyUsage) {
          await storage.incrementDailyUsage('proactive_resume_views', 1);
        }
        const rating = await aiRating.analyzeResume(resumeData);
        const ratingResult = {
          candidateId: id,
          candidateName: candidate.candidate_name || candidate.name || '',
          name: candidate.candidate_name || candidate.name || '',
          ...rating
        };
        ctx.ratingResults.unshift(ratingResult);
        report('AUTO_RATING', ratingResult);
        ctx.stats.rated += 1;
        const decision = messaging.decideMessageForRating(rating, settings, candidate);
        await sendDecision(candidate, decision);
        ctx.candidateActions[id] = { rated: true, rating: rating.rating, messageAction: decision.action };
        log('rated', candidate, `${rating.rating} ${rating.summary || ''}`.trim(), { rating: rating.rating });
      } catch (error) {
        ctx.stats.systemFailed += 1;
        ctx.candidateActions[id] = { systemFailed: true, error: error.message || String(error) };
        log('system_failure', candidate, error.message || String(error));
      }

      ctx.processedIds.push(id);
      ctx.stats.processed += 1;
      await persist();
    }

    async function run(payload = {}) {
      const settings = await getSettings();
      ctx.runLimitMinutes = Math.round(runTimeLimitMs(settings) / 60000);
      ensureRunDeadline(settings);
      ctx.lastText = ctx.mode === 'proactive' ? '牛人筛选运行中' : '智能跟进运行中';
      report('AUTO_PROGRESS', { text: ctx.lastText, snapshot: snapshot() });

      const candidates = browserOps?.scanCandidates
        ? await browserOps.scanCandidates({ mode: ctx.mode, subMode: ctx.subMode, settings, payload })
        : [];

      for (let i = 0; i < candidates.length; i += 1) {
        if (ctx.abort) break;
        if (ctx.stats.processed > 0 && runTimeLimitReached(settings)) {
          requestStop('已达到单次运行时长上限');
          await persist({ reason: ctx.lastText });
          break;
        }
        await processCandidate(candidates[i], i, settings);
        ctx.lastStats = `已处理 ${ctx.stats.processed}，评级 ${ctx.stats.rated}，业务不通过 ${ctx.stats.businessFailed}，系统失败 ${ctx.stats.systemFailed}`;
        report('AUTO_STATS', { text: ctx.lastStats });
        if (!ctx.abort && runTimeLimitReached(settings)) {
          requestStop('已达到单次运行时长上限');
          await persist({ reason: ctx.lastText });
        }
      }

      if (ctx.pauseRequested) {
        const pauseState = await savePauseState(settings);
        ctx.running = false;
        ctx.paused = true;
        ctx.stoppedAt = now().toISOString();
        const ttlMinutes = Math.max(1, Math.ceil((pauseState.ttlMs || 15 * 60 * 1000) / 60000));
        const remainingMinutes = Math.max(1, Math.ceil((pauseState.remainingMs || 0) / 60000));
        ctx.lastText = `已暂停（${ttlMinutes} 分钟内可继续，剩余约 ${remainingMinutes} 分钟）`;
        await persist({ reason: ctx.lastText, paused: true, pauseState });
        report('AUTO_PAUSED', { reason: ctx.lastText, pauseState, snapshot: snapshot() });
        report('AUTO_STOPPED', { reason: ctx.lastText, paused: true });
        return;
      }

      ctx.running = false;
      ctx.paused = false;
      ctx.stoppedAt = now().toISOString();
      ctx.lastText = ctx.abort ? (ctx.lastText || '已停止') : '处理完成';
      await clearPauseState();
      await persist({ reason: ctx.lastText });
      if (storage?.appendRunHistory) await storage.appendRunHistory(snapshot({ reason: ctx.lastText }));
      await maybeDownloadRunLog(settings, ctx.lastText);
      report('AUTO_STOPPED', { reason: ctx.lastText });
    }

    async function start(payload = {}) {
      if (ctx.running) return 'started';
      ctx.running = true;
      ctx.abort = false;
      ctx.mode = payload.mode === 'proactive' ? 'proactive' : 'follow';
      ctx.subMode = String(payload.subMode || '');
      ctx.startedAt = now().toISOString();
      ctx.runDeadline = '';
      ctx.runLimitMinutes = 0;
      ctx.stoppedAt = '';
      ctx.paused = false;
      ctx.pauseRequested = false;
      ctx.lastText = ctx.mode === 'proactive' ? '牛人筛选已启动' : '智能跟进已启动';
      ctx.lastStats = '';
      const restoredRunState = await loadRestorableRunState(ctx.mode, ctx.subMode);
      if (restoredRunState) {
        restoreFromRunState(restoredRunState);
      } else {
        ctx.processLog = [];
        ctx.ratingResults = [];
        ctx.processedIds = [];
        ctx.candidateActions = {};
        ctx.stats = defaultStats();
      }

      if (!restoredRunState && storage?.incrementDailyUsage) {
        await clearPauseState();
        await storage.incrementDailyUsage(ctx.mode === 'proactive' ? 'proactive_runs' : 'follow_runs', 1);
      }
      await persist(restoredRunState ? { restoredFrom: 'runState' } : {});
      ctx.currentPromise = run(payload).catch(async (error) => {
        ctx.running = false;
        ctx.stoppedAt = now().toISOString();
        ctx.lastText = error.message || String(error);
        log('system_failure', null, ctx.lastText);
        await persist({ reason: ctx.lastText });
        report('AUTO_ERROR', { message: ctx.lastText });
      });
      return 'started';
    }

    async function stop(reason = 'user') {
      ctx.abort = true;
      ctx.pauseRequested = reason === 'user' || reason === 'pause';
      ctx.lastText = ctx.pauseRequested ? '正在暂停，当前候选人处理完成后可继续' : '已停止';
      if (!ctx.running) {
        ctx.paused = Boolean(ctx.pauseRequested);
        ctx.stoppedAt = now().toISOString();
      }
      await persist({ reason, abortRequested: true, pauseRequested: ctx.pauseRequested });
      report('AUTO_PROGRESS', { text: ctx.lastText, snapshot: snapshot() });
      if (!ctx.running && !ctx.pauseRequested) report('AUTO_STOPPED', { reason });
      return 'stopping';
    }

    async function resume() {
      if (ctx.running) return 'started';
      const pauseState = storage?.getPauseState ? await storage.getPauseState(now()) : null;
      if (!pauseState) {
        const error = new Error('无可恢复的暂停任务');
        error.code = 'no_pause_state';
        throw error;
      }
      restoreFromPauseState(pauseState);
      ctx.running = true;
      await clearPauseState();
      await persist({ resumedFrom: 'pauseState' });
      ctx.currentPromise = run({ mode: ctx.mode, subMode: ctx.subMode, resume: true }).catch(async (error) => {
        ctx.running = false;
        ctx.stoppedAt = now().toISOString();
        ctx.lastText = error.message || String(error);
        log('system_failure', null, ctx.lastText);
        await persist({ reason: ctx.lastText });
        report('AUTO_ERROR', { message: ctx.lastText });
      });
      return 'started';
    }

    async function waitForIdle() {
      if (ctx.currentPromise) await ctx.currentPromise;
    }

    return {
      ctx,
      processCandidate,
      snapshot,
      resume,
      start,
      stop,
      waitForIdle
    };
  }

  const api = {
    createAutomation
  };

  root.BHPAutomation = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
