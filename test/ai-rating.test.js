const test = require('node:test');
const assert = require('node:assert/strict');

const { createAiRating } = require('../src/modules/ai-rating.js');

test('AI rating requires BYO configuration', async () => {
  const rating = createAiRating({
    settingsProvider: async () => ({
      rating_prompt: 'rate',
      byo: {
        enabled: true,
        url: '',
        key: '',
        model: ''
      }
    }),
    byoProvider: {
      analyze: async () => ({ rating: 'A', summary: 'ok', risk: '' })
    }
  });

  await assert.rejects(() => rating.analyzeResume({ resumeText: 'x' }), /请先配置自定义 AI/);
});

test('AI rating uses BYO only and propagates provider errors', async () => {
  const byoError = new Error('BYO down');
  const rating = createAiRating({
    settingsProvider: async () => ({
      rating_prompt: 'rate',
      byo: {
        enabled: true,
        url: 'https://api.example.com/v1',
        key: 'sk',
        model: 'gpt-4o-mini',
        advanced: {}
      }
    }),
    byoProvider: {
      analyze: async () => {
        throw byoError;
      }
    },
  });

  await assert.rejects(() => rating.analyzeResume({ resumeText: 'x' }), /BYO down/);
});

test('AI rating returns normalized BYO result', async () => {
  const rating = createAiRating({
    settingsProvider: async () => ({
      rating_prompt: 'rate',
      byo: {
        enabled: true,
        url: 'https://api.example.com/v1',
        key: 'sk',
        model: 'gpt-4o-mini',
        advanced: {}
      }
    }),
    byoProvider: {
      analyze: async () => {
        return { rating: 'B', summary: '匹配', risk: '项目偏少' };
      }
    }
  });

  assert.deepEqual(await rating.analyzeResume({ resumeText: 'x' }), {
    rating: 'B',
    summary: '匹配',
    risk: '项目偏少',
    source: 'byo'
  });
});
