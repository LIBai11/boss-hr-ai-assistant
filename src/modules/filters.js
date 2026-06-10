(function initFiltersModule(root) {
  'use strict';

  function normalize(value) {
    return String(value || '').trim().toLowerCase();
  }

  function parseAge(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const match = String(value || '').match(/(\d{1,2})\s*岁?/);
    return match ? Number(match[1]) : null;
  }

  function listFrom(value) {
    if (root.BHPSettings?.listFromValue) return root.BHPSettings.listFromValue(value);
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    if (typeof value === 'string') return value.split(/\r?\n|,|，/).map((item) => item.trim()).filter(Boolean);
    return [];
  }

  function textMatchesAny(text, list) {
    const haystack = normalize(text);
    if (!haystack) return false;
    return listFrom(list).some((item) => {
      const needle = normalize(item);
      return Boolean(needle) && (haystack.includes(needle) || needle.includes(haystack));
    });
  }

  function candidateSchool(candidate) {
    if (Array.isArray(candidate.schools)) return candidate.schools.join(' ');
    return candidate.school || candidate.education || candidate.schoolName || '';
  }

  function candidateCompany(candidate) {
    if (Array.isArray(candidate.companies)) return candidate.companies.join(' ');
    return candidate.company || candidate.currentCompany || candidate.lastCompany || candidate.companyName || '';
  }

  function evaluateCandidate(candidate, config) {
    const cfg = config || {};
    const age = parseAge(candidate.age ?? candidate.ageText);
    const maxAge = Number(cfg.age_max || 0);
    if (age !== null && maxAge > 0 && age > maxAge) {
      return { passed: false, reason: '年龄超过上限' };
    }

    const schoolEnabled = Boolean(cfg.school_filter_enabled);
    const companyEnabled = Boolean(cfg.company_filter_enabled);
    if (!schoolEnabled && !companyEnabled) return { passed: true, reason: '通过' };

    const schoolMatch = schoolEnabled ? textMatchesAny(candidateSchool(candidate), cfg.schools) : false;
    const companyMatch = companyEnabled ? textMatchesAny(candidateCompany(candidate), cfg.companies) : false;

    if (schoolEnabled && companyEnabled) {
      if (schoolMatch || companyMatch) return { passed: true, reason: '通过白名单' };
      return { passed: false, reason: '学校和公司均不在白名单' };
    }
    if (schoolEnabled) {
      if (schoolMatch) return { passed: true, reason: '学校白名单通过' };
      return { passed: false, reason: '学校不在白名单' };
    }
    if (companyMatch) return { passed: true, reason: '公司白名单通过' };
    return { passed: false, reason: '公司不在白名单' };
  }

  function proactiveConfigFromSettings(settings) {
    const pro = settings?.proactive_screening || {};
    return {
      age_max: pro.age_max,
      school_filter_enabled: pro.school_filter_enabled,
      schools: pro.schools,
      company_filter_enabled: pro.company_filter_enabled,
      companies: pro.companies
    };
  }

  function evaluateProactiveCandidate(candidate, settings) {
    return evaluateCandidate(candidate, proactiveConfigFromSettings(settings));
  }

  const api = {
    evaluateCandidate,
    evaluateProactiveCandidate,
    parseAge,
    proactiveConfigFromSettings,
    textMatchesAny
  };

  root.BHPFilters = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
