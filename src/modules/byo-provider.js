(function initByoProviderModule(root) {
  'use strict';

  const VALID_PROTOCOLS = ['openai', 'anthropic', 'gemini'];

  function trimSlash(url) {
    return String(url || '').trim().replace(/\/+$/, '');
  }

  function detectProtocol({ url = '', forceProtocol = 'auto', protocol = 'auto' } = {}) {
    const forced = forceProtocol && forceProtocol !== 'auto' ? forceProtocol : protocol;
    if (VALID_PROTOCOLS.includes(forced)) return forced;
    const lower = String(url || '').toLowerCase();
    if (lower.includes('anthropic.com')) return 'anthropic';
    if (lower.includes('googleapis.com') || lower.includes('generativelanguage')) return 'gemini';
    return 'openai';
  }

  function isProbablyMultimodal(model) {
    const name = String(model || '').toLowerCase();
    if (!name) return false;
    const patterns = [
      /^gpt-4o\b/, /^gpt-4\.1\b/, /^gpt-5\b/, /^o[1-9]\b/,
      /claude-(3|4|opus|sonnet|haiku)/, /gemini/,
      /qwen.*vl/, /glm-4v/, /internvl/, /deepseek-vl/,
      /llama.*vision/, /llava/, /pixtral/, /molmo/, /\bvl\b/, /vision/
    ];
    return patterns.some((pattern) => pattern.test(name));
  }

  function parseHeaderLines(lines) {
    const headers = {};
    String(lines || '').split(/\r?\n/).forEach((line) => {
      const idx = line.indexOf(':');
      if (idx <= 0) return;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key && value) headers[key] = value;
    });
    return headers;
  }

  function stripCodeFence(text) {
    return String(text || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  }

  function normalizeRatingResult(value) {
    if (typeof value === 'string') return extractRatingFromText(value);
    const rating = String(value?.rating || value?.grade || '').trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(rating)) throw new Error('AI 评级结果缺少 A/B/C/D rating');
    return {
      rating,
      summary: String(value.summary || value.reason || value.advantage || '').trim(),
      risk: String(value.risk || value.weakness || value.concern || '').trim()
    };
  }

  function extractRatingFromText(text) {
    const cleaned = stripCodeFence(text);
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return normalizeRatingResult(JSON.parse(jsonMatch[0]));
      } catch (error) {
        // Fall through to loose parsing below.
      }
    }
    const gradeMatch = cleaned.match(/(?:rating|评级|等级)\s*[:：]?\s*["']?([ABCD])["']?/i) || cleaned.match(/\b([ABCD])\s*级/i);
    if (!gradeMatch) throw new Error('无法解析 AI 评级结果');
    return {
      rating: gradeMatch[1].toUpperCase(),
      summary: cleaned.slice(0, 120),
      risk: ''
    };
  }

  function extractTextFromContent(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content.map((part) => {
        if (typeof part === 'string') return part;
        return part?.text || part?.content || '';
      }).join('\n');
    }
    return content?.text || '';
  }

  function extractRatingFromResponse(response) {
    if (!response) throw new Error('AI 响应为空');
    if (response.rating || response.grade) return normalizeRatingResult(response);

    const openAiText = response.choices?.[0]?.message?.content || response.choices?.[0]?.text;
    if (openAiText) return extractRatingFromText(openAiText);

    const anthropicText = extractTextFromContent(response.content);
    if (anthropicText) return extractRatingFromText(anthropicText);

    const geminiText = response.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n');
    if (geminiText) return extractRatingFromText(geminiText);

    throw new Error('AI 响应格式不支持');
  }

  function buildPrompt(resumeData, prompt) {
    const parts = [
      prompt || root.BHPSettings?.DEFAULT_SETTINGS?.rating_prompt || '',
      '',
      `岗位：${resumeData?.position || ''}`,
      `简历文本：${resumeData?.resumeText || resumeData?.resume_text || ''}`,
      resumeData?.resumeUrl || resumeData?.resume_url ? `简历链接：${resumeData.resumeUrl || resumeData.resume_url}` : ''
    ];
    return parts.filter(Boolean).join('\n');
  }

  function endpointFor(config, protocol) {
    const base = trimSlash(config.url);
    const model = encodeURIComponent(config.model || '');
    if (protocol === 'openai') {
      if (/\/chat\/completions$/.test(base)) return base;
      return `${base.replace(/\/v1$/, '')}/v1/chat/completions`;
    }
    if (protocol === 'anthropic') {
      if (/\/messages$/.test(base)) return base;
      return `${base.replace(/\/v1$/, '')}/v1/messages`;
    }
    if (/:generateContent$/.test(base)) return base;
    if (/\/v1beta$/.test(base)) return `${base}/models/${model}:generateContent`;
    return `${base}/v1beta/models/${model}:generateContent`;
  }

  function buildCompletionRequest(config, text, options = {}) {
    const advanced = config.advanced || {};
    const protocol = detectProtocol({ url: config.url, protocol: config.protocol, forceProtocol: advanced.force_protocol });
    const headers = {
      ...parseHeaderLines(advanced.headers),
      'Content-Type': 'application/json'
    };
    let body;

    if (protocol === 'openai') {
      headers.Authorization = `Bearer ${config.key}`;
      body = {
        model: config.model,
        messages: [{ role: 'user', content: text }],
        temperature: options.temperature ?? 0
      };
      if (options.maxTokens) body.max_tokens = options.maxTokens;
    } else if (protocol === 'anthropic') {
      headers['x-api-key'] = config.key;
      headers['anthropic-version'] = headers['anthropic-version'] || '2023-06-01';
      body = {
        model: config.model,
        max_tokens: options.maxTokens || 800,
        messages: [{ role: 'user', content: text }]
      };
    } else {
      if (config.key && !headers.Authorization) headers['x-goog-api-key'] = config.key;
      body = {
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: { temperature: options.temperature ?? 0 }
      };
      if (options.maxTokens) body.generationConfig.maxOutputTokens = options.maxTokens;
    }

    return {
      protocol,
      url: endpointFor(config, protocol),
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      }
    };
  }

  function buildRequest(config, resumeData, prompt) {
    return buildCompletionRequest(config, buildPrompt(resumeData, prompt), {
      temperature: 0
    });
  }

  async function fetchJsonWithTimeout(url, init, timeoutMs = 30000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (error) {
        data = { text };
      }
      if (!response.ok) {
        const err = new Error(data?.error?.message || data?.error || `HTTP ${response.status}`);
        err.status = response.status;
        err.data = data;
        throw err;
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async function testConnection(config) {
    if (!config?.url || !config?.key || !config?.model) {
      return { success: false, multimodal: false, detail: '请填写 Base URL / API Key / Model' };
    }
    const multimodal = isProbablyMultimodal(config.model);
    const request = buildRequest(config, { resumeText: "Say 'OK' if you can read this.", position: 'probe' }, "Say 'OK' if you can read this.");
    try {
      const response = await fetchJsonWithTimeout(request.url, request.init, 30000);
      const rawText = JSON.stringify(response);
      const ok = /ok/i.test(rawText);
      return {
        success: ok,
        multimodal,
        protocol: request.protocol,
        detail: ok ? '连接成功' : '接口可访问，但响应未包含 OK'
      };
    } catch (error) {
      return {
        success: false,
        multimodal,
        protocol: request.protocol,
        detail: error.message || String(error)
      };
    }
  }

  async function analyze(config, resumeData, prompt) {
    const request = buildRequest(config, resumeData, prompt);
    const response = await fetchJsonWithTimeout(request.url, request.init, 30000);
    return extractRatingFromResponse(response);
  }

  function extractTextFromResponse(response) {
    if (!response) throw new Error('AI 响应为空');
    const openAiText = response.choices?.[0]?.message?.content || response.choices?.[0]?.text;
    if (openAiText) return String(openAiText).trim();
    const anthropicText = extractTextFromContent(response.content);
    if (anthropicText) return String(anthropicText).trim();
    const geminiText = response.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n');
    if (geminiText) return String(geminiText).trim();
    if (response.text) return String(response.text).trim();
    throw new Error('AI 响应格式不支持');
  }

  async function generateText(config, prompt, options = {}) {
    const request = buildCompletionRequest(config, String(prompt || ''), {
      maxTokens: options.maxTokens || 1200,
      temperature: options.temperature ?? 0.4
    });
    const response = await fetchJsonWithTimeout(request.url, request.init, options.timeoutMs || 30000);
    return extractTextFromResponse(response);
  }

  const api = {
    analyze,
    buildCompletionRequest,
    buildRequest,
    detectProtocol,
    extractRatingFromResponse,
    extractRatingFromText,
    extractTextFromResponse,
    generateText,
    isProbablyMultimodal,
    normalizeRatingResult,
    parseHeaderLines,
    testConnection
  };

  root.BHPByoProvider = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
