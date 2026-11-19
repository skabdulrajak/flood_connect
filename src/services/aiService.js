/**
 * FloodConnect AI Service Boundary (Server-Side Gemini API Proxy)
 *
 * All Gemini API calls route through the server-side Express proxy (/api/gemini/*)
 * powered by @google/genai (gemini-4-hydrogen & gemini-3.1-flash-lite).
 *
 * AI GOVERNANCE RULES:
 * 1. Every triage response is tagged origin: 'ai_suggested'.
 * 2. AI NEVER verifies an incident or changes incident status to 'verified'.
 * 3. AI NEVER auto-merges or deletes duplicate reports.
 * 4. AI NEVER fabricates incidents, rainfall, river levels, or official alerts.
 * 5. If the server reports Gemini is unconfigured, deterministic rule-based
 *    fallbacks return the visible notice: "AI unavailable, using basic rules".
 */

import { envConfig } from '../utils/envConfig';
import {
  getIncidentCategoryLabel,
  haversineDistanceKm,
  INCIDENT_CATEGORIES,
} from '../utils/constants';

export const AI_FALLBACK_NOTICE = 'AI unavailable, using basic rules';
export const GEMINI_MODEL = 'gemini-4-hydrogen';
export const GEMINI_FAST_MODEL = 'gemini-3.1-flash-lite';

export const AI_CONFIG = {
  endpointBaseUrl: envConfig.aiBackendUrl || '/api/gemini',
  model: GEMINI_MODEL,
};

const VALID_CATEGORIES = INCIDENT_CATEGORIES.map((c) => c.value);
const VALID_URGENCIES = ['low', 'medium', 'high', 'critical'];

export function getAiServiceStatus() {
  return {
    configured: true,
    mode: 'server_proxy',
    model: AI_CONFIG.model,
    message: `Connected to server-side Gemini API proxy (${AI_CONFIG.endpointBaseUrl}).`,
  };
}

async function callServerAi(path, payload) {
  const base = (AI_CONFIG.endpointBaseUrl || '/api/gemini').replace(/\/$/, '');
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.error || `AI endpoint returned HTTP ${response.status}`);
    err.status = response.status;
    err.code = data?.code || '';
    throw err;
  }
  return data;
}

// ============================================================================
// MULTI-TURN CHATBOT (Server-Side Gemini API)
// ============================================================================

export async function sendAssistantChatMessage({
  history = [],
  message = '',
  model = GEMINI_MODEL,
  language = 'en',
  role = 'citizen',
  contextSummary = '',
}) {
  return callServerAi('/chat', {
    history,
    message,
    model,
    language,
    role,
    contextSummary,
  });
}

// ============================================================================
// RULE-BASED TEXT UTILITIES & KEYWORD DICTIONARIES (Offline/Fallback Safety)
// ============================================================================

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'near', 'from', 'that', 'this', 'have', 'been',
  'into', 'over', 'under', 'after', 'before', 'about', 'around', 'there', 'their',
  'where', 'when', 'what', 'which', 'while', 'very', 'some', 'more', 'area',
  'people', 'water', 'flood', 'flooding', 'east', 'godavari', 'road', 'reported',
]);

function tokenizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

function computeTextSimilarity(textA, textB) {
  const tokensA = new Set(tokenizeText(textA));
  const tokensB = new Set(tokenizeText(textB));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection += 1;
  }
  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}

const CATEGORY_RULES = [
  {
    category: 'bridge_blockage',
    keywords: ['bridge', 'culvert', 'causeway', 'submerged bridge', 'overpass', 'crossing', 'blocked', 'వారధి', 'వంతెన'],
  },
  {
    category: 'embankment_breach',
    keywords: ['embankment', 'bund', 'breach', 'levee', 'seepage', 'canal bank', 'dam', 'barrage', 'overflowing bank', 'గట్టు', 'కట్ట'],
  },
  {
    category: 'power_utility_hazard',
    keywords: ['electric', 'electricity', 'wire', 'pole', 'transformer', 'live wire', 'power', 'spark', 'short circuit', 'కరెంట్', 'విద్యుత్'],
  },
  {
    category: 'drainage_overflow',
    keywords: ['drain', 'drainage', 'sewer', 'manhole', 'gutter', 'clogged', 'storm drain', 'కాలువ', 'డ్రైనేజీ'],
  },
  {
    category: 'road_waterlogging',
    keywords: ['road', 'highway', 'nh-16', 'nh16', 'junction', 'street', 'traffic', 'vehicles', 'waterlogging', 'submerged road', 'రోడ్డు', 'రహదారి'],
  },
  {
    category: 'residential_flooding',
    keywords: ['house', 'home', 'colony', 'ground floor', 'terrace', 'apartment', 'residential', 'ward', 'village', 'family', 'families', 'ఇల్లు', 'ఇళ్లలోకి', 'కాలనీ'],
  },
];

const URGENCY_RULES = {
  critical: [
    'trapped', 'stranded', 'rapidly rising', 'chest deep', 'neck deep', 'collapse', 'washed away',
    'live wire', 'electrocution', 'breach', 'cut off', 'cut-off', 'isolated', 'roof', 'terrace',
    'swept away', 'emergency', 'urgent', 'life threat', 'మునిగిపోయింది', 'చిక్కుకున్నాము', 'ప్రమాదం',
  ],
  high: [
    'waist deep', 'knee deep', 'entered houses', 'entered homes', 'ground floor', 'submerged',
    'blocked', 'impassable', 'impassible', 'strong current', 'rising', 'evacuate', 'evacuation',
    'elderly', 'children', 'medical', 'మోకాలి', 'ఇళ్లలోకి నీరు',
  ],
  medium: [
    'waterlogging', 'ankle deep', 'slow traffic', 'overflow', 'overflowing', 'drainage',
    'stagnant', 'slippery', 'puddles', 'diversion', 'నీరు నిలిచింది',
  ],
};

function ruleBasedClassifyIncident({ title = '', description = '', locality = '', location_text = '' }) {
  const combined = `${title} ${description} ${location_text} ${locality}`.toLowerCase();

  let bestCategory = 'other';
  let bestScore = 0;
  const matchedKeywords = new Set();

  for (const rule of CATEGORY_RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (combined.includes(kw)) {
        score += kw.includes(' ') ? 2 : 1;
        matchedKeywords.add(kw);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = rule.category;
    }
  }

  let suggestedUrgency = 'low';
  for (const kw of URGENCY_RULES.critical) {
    if (combined.includes(kw)) {
      suggestedUrgency = 'critical';
      matchedKeywords.add(kw);
    }
  }
  if (suggestedUrgency === 'low') {
    for (const kw of URGENCY_RULES.high) {
      if (combined.includes(kw)) {
        suggestedUrgency = 'high';
        matchedKeywords.add(kw);
      }
    }
  }
  if (suggestedUrgency === 'low') {
    for (const kw of URGENCY_RULES.medium) {
      if (combined.includes(kw)) {
        suggestedUrgency = 'medium';
        matchedKeywords.add(kw);
      }
    }
  }

  if (matchedKeywords.size < 3) {
    const extraTokens = tokenizeText(`${title} ${description}`).slice(0, 5);
    extraTokens.forEach((t) => matchedKeywords.add(t));
  }

  const keywords = Array.from(matchedKeywords).slice(0, 6);
  const categoryLabel = getIncidentCategoryLabel(bestCategory);
  const locationDisplay = location_text || locality || 'East Godavari';
  const snippet = String(description || title || '').trim().slice(0, 140);
  const shortSummary = snippet
    ? `${categoryLabel} reported near ${locationDisplay} (${suggestedUrgency} suggested urgency): ${snippet}${
        String(description || '').length > 140 ? '...' : ''
      }`
    : `${categoryLabel} reported near ${locationDisplay} with ${suggestedUrgency} suggested urgency.`;

  return {
    origin: 'ai_suggested',
    usedFallback: true,
    fallbackNotice: AI_FALLBACK_NOTICE,
    suggestedCategory: bestCategory,
    suggestedUrgency,
    keywords,
    shortSummary,
    humanReviewRequired: 'Yes',
    disclaimer:
      'AI suggestions never verify an incident. A District Administrator must review and confirm before public release.',
  };
}

// ============================================================================
// 1. INCIDENT CLASSIFICATION
// ============================================================================

export async function classifyIncident({
  title = '',
  description = '',
  locality = '',
  location_text = '',
}) {
  const cleanTitle = String(title || '').trim();
  const cleanDesc = String(description || '').trim();

  if (!cleanTitle && !cleanDesc) {
    return {
      ...ruleBasedClassifyIncident({ title, description, locality, location_text }),
      shortSummary: 'Provide an incident headline or description to run AI classification.',
    };
  }

  try {
    const parsed = await callServerAi('/classify', {
      title: cleanTitle,
      description: cleanDesc,
      locality,
      location_text,
      validCategories: VALID_CATEGORIES,
    });
    if (parsed?.suggestedCategory) {
      const safeCategory = VALID_CATEGORIES.includes(parsed.suggestedCategory)
        ? parsed.suggestedCategory
        : 'other';
      const safeUrgency = VALID_URGENCIES.includes(String(parsed.suggestedUrgency || '').toLowerCase())
        ? String(parsed.suggestedUrgency).toLowerCase()
        : 'medium';

      return {
        origin: 'ai_suggested',
        usedFallback: false,
        fallbackNotice: '',
        suggestedCategory: safeCategory,
        suggestedUrgency: safeUrgency,
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 6) : [],
        shortSummary: String(parsed.shortSummary || '').trim(),
        humanReviewRequired: 'Yes',
        disclaimer:
          'AI-suggested classification only. AI can never verify an incident; human admin review is required.',
      };
    }
  } catch {
    // Transparent fallback to basic rules
  }

  return ruleBasedClassifyIncident({ title: cleanTitle, description: cleanDesc, locality, location_text });
}

// ============================================================================
// 2. DUPLICATE DETECTION (Haversine + Time Window + Category + Text Similarity)
// ============================================================================

export async function detectDuplicateIncidents(targetIncident, allIncidents = []) {
  if (!targetIncident) {
    return {
      origin: 'ai_suggested',
      usedFallback: false,
      fallbackNotice: '',
      matches: [],
      humanReviewRequired: 'Yes',
      disclaimer:
        'Duplicate scoring is advisory only. FloodConnect never auto-merges or deletes reports.',
    };
  }

  const targetLat = Number(targetIncident.latitude);
  const targetLng = Number(targetIncident.longitude);
  const targetTime = new Date(targetIncident.observed_at || targetIncident.created_at || Date.now()).getTime();
  const targetText = `${targetIncident.title || ''} ${targetIncident.description || ''} ${
    targetIncident.location_text || ''
  } ${targetIncident.locality || ''}`;

  const scoredCandidates = (allIncidents || [])
    .filter((other) => other && other.id !== targetIncident.id)
    .map((other) => {
      const otherLat = Number(other.latitude);
      const otherLng = Number(other.longitude);
      const hasCoords =
        Number.isFinite(targetLat) &&
        Number.isFinite(targetLng) &&
        Number.isFinite(otherLat) &&
        Number.isFinite(otherLng);

      const distanceKm = hasCoords
        ? Number(haversineDistanceKm(targetLat, targetLng, otherLat, otherLng).toFixed(2))
        : null;

      let distancePts = 0;
      if (distanceKm !== null) {
        if (distanceKm <= 0.3) distancePts = 35;
        else if (distanceKm <= 1.0) distancePts = 28;
        else if (distanceKm <= 2.5) distancePts = 20;
        else if (distanceKm <= 5.0) distancePts = 10;
        else if (distanceKm <= 10.0) distancePts = 4;
      } else if (
        targetIncident.locality &&
        other.locality &&
        targetIncident.locality === other.locality
      ) {
        distancePts = 18;
      }

      const otherTime = new Date(other.observed_at || other.created_at || Date.now()).getTime();
      const timeDiffHours = Number((Math.abs(targetTime - otherTime) / (1000 * 60 * 60)).toFixed(1));

      let timePts = 0;
      if (timeDiffHours <= 2) timePts = 20;
      else if (timeDiffHours <= 6) timePts = 16;
      else if (timeDiffHours <= 24) timePts = 10;
      else if (timeDiffHours <= 48) timePts = 5;

      const sameCategory = Boolean(targetIncident.category && other.category === targetIncident.category);
      const categoryPts = sameCategory ? 20 : 0;

      const otherText = `${other.title || ''} ${other.description || ''} ${
        other.location_text || ''
      } ${other.locality || ''}`;
      const textSim = computeTextSimilarity(targetText, otherText);
      const textSimilarityPct = Math.round(textSim * 100);
      const textPts = Math.min(25, Math.round(textSim * 35));

      const score = Math.min(100, distancePts + timePts + categoryPts + textPts);

      const reasons = [];
      if (distanceKm !== null && distanceKm <= 5) reasons.push(`${distanceKm} km apart`);
      if (timeDiffHours <= 24) reasons.push(`${timeDiffHours}h time gap`);
      if (sameCategory) reasons.push('Same hazard category');
      if (textSimilarityPct >= 15) reasons.push(`${textSimilarityPct}% text overlap`);

      return {
        incidentId: other.id,
        incidentCode: other.incident_code,
        title: other.title,
        locality: other.locality,
        status: other.status,
        category: other.category,
        score,
        distanceKm,
        timeDiffHours,
        sameCategory,
        textSimilarityPct,
        reasons,
        aiNote: '',
      };
    })
    .filter((c) => c.score >= 28)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  let usedFallback = false;
  let fallbackNotice = '';

  if (scoredCandidates.length > 0) {
    try {
      const candidateSummary = scoredCandidates.map((c) => {
        const full = allIncidents.find((i) => i.id === c.incidentId);
        return {
          incidentCode: c.incidentCode,
          score: c.score,
          distanceKm: c.distanceKm,
          timeDiffHours: c.timeDiffHours,
          sameCategory: c.sameCategory,
          title: full?.title || c.title,
          description: String(full?.description || '').slice(0, 180),
        };
      });

      const parsed = await callServerAi('/duplicates', {
        targetIncident: {
          incident_code: targetIncident.incident_code,
          title: targetIncident.title,
          description: String(targetIncident.description || '').slice(0, 220),
          category: targetIncident.category,
          locality: targetIncident.locality,
        },
        candidates: candidateSummary,
      });

      if (parsed && Array.isArray(parsed.notes)) {
        const noteMap = new Map(parsed.notes.map((n) => [n.incidentCode, n.note]));
        scoredCandidates.forEach((c) => {
          if (noteMap.has(c.incidentCode)) {
            c.aiNote = String(noteMap.get(c.incidentCode));
          }
        });
      }
    } catch {
      usedFallback = true;
      fallbackNotice = AI_FALLBACK_NOTICE;
    }
  }

  return {
    origin: 'ai_suggested',
    usedFallback,
    fallbackNotice,
    matches: scoredCandidates,
    humanReviewRequired: 'Yes',
    disclaimer:
      'Possible duplicates are advisory scores (Haversine distance + time window + category + text similarity). Reports are never auto-merged or deleted.',
  };
}

// ============================================================================
// 3. EMERGENCY PRIORITY SUGGESTION
// ============================================================================

function ruleBasedSuggestEmergencyPriority(payload) {
  const peopleCount = Number(payload.people_count) || 1;
  const childrenCount = Number(payload.children_count) || 0;
  const elderlyCount = Number(payload.elderly_count) || 0;
  const medicalText = String(payload.medical_needs || '').trim();
  const accessText = String(payload.accessibility_needs || '').trim();
  const descText = String(payload.description || '').trim();
  const combined = `${medicalText} ${accessText} ${descText}`.toLowerCase();

  let riskScore = 0;
  const riskFactors = [];

  const trappedDetected =
    Boolean(payload.is_trapped) ||
    /trapped|stranded|cannot exit|stuck|roof|terrace|upper floor|first floor|surrounded|cut off|చిక్కుకున్నాము/.test(
      combined
    );

  if (trappedDetected) {
    riskScore += 45;
    riskFactors.push('Trapped or stranded status indicated');
  }

  const criticalMedical =
    /insulin|oxygen|dialysis|pregnant|heart|cardiac|asthma|bleeding|unconscious|stroke|seizure|fracture|infant|newborn|ventilator|emergency medicine/.test(
      combined
    );

  if (criticalMedical) {
    riskScore += 35;
    riskFactors.push('Critical medical need noted');
  } else if (medicalText.length > 0 && !/^(none|no|nil|na|n\/a)$/i.test(medicalText)) {
    riskScore += 20;
    riskFactors.push('Medical assistance required');
  }

  if (accessText.length > 0 && !/^(none|no|nil|na|n\/a)$/i.test(accessText)) {
    riskScore += 18;
    riskFactors.push('Mobility / accessibility support needed');
  }

  if (childrenCount > 0 || elderlyCount > 0) {
    riskScore += 15;
    riskFactors.push(
      `Vulnerable residents present (${childrenCount} children, ${elderlyCount} elderly)`
    );
  }

  if (peopleCount >= 6) {
    riskScore += 15;
    riskFactors.push(`Large household group (${peopleCount} people)`);
  } else if (peopleCount >= 3) {
    riskScore += 8;
    riskFactors.push(`Multi-person household (${peopleCount} people)`);
  }

  if (/rising|fast current|chest|neck|submerged|power cut|collapsed|snake|dark/.test(combined)) {
    riskScore += 22;
    riskFactors.push('Active water-level or environmental hazard described');
  }

  let suggestedPriority = 'low';
  if (riskScore >= 55) suggestedPriority = 'critical';
  else if (riskScore >= 35) suggestedPriority = 'high';
  else if (riskScore >= 18) suggestedPriority = 'medium';

  const rationale =
    riskFactors.length > 0
      ? `Suggested ${suggestedPriority.toUpperCase()} priority based on: ${riskFactors.join('; ')}.`
      : `Suggested ${suggestedPriority.toUpperCase()} priority based on ${peopleCount} person(s) and current situation details.`;

  return {
    origin: 'ai_suggested',
    usedFallback: true,
    fallbackNotice: AI_FALLBACK_NOTICE,
    suggestedPriority,
    rationale,
    riskFactors,
    trappedDetected,
    humanReviewRequired: 'Yes',
    disclaimer:
      'Priority suggestion is advisory only. District Control Room admins make the final triage and rescue dispatch decision.',
  };
}

export async function suggestEmergencyPriority(payload = {}) {
  const baseline = ruleBasedSuggestEmergencyPriority(payload);

  try {
    const parsed = await callServerAi('/priority', {
      people_count: payload.people_count,
      children_count: payload.children_count,
      elderly_count: payload.elderly_count,
      is_trapped: payload.is_trapped,
      medical_needs: payload.medical_needs,
      accessibility_needs: payload.accessibility_needs,
      locality: payload.locality,
      description: payload.description,
    });

    if (parsed?.suggestedPriority) {
      const safePriority = VALID_URGENCIES.includes(
        String(parsed.suggestedPriority || '').toLowerCase()
      )
        ? String(parsed.suggestedPriority).toLowerCase()
        : baseline.suggestedPriority;

      return {
        origin: 'ai_suggested',
        usedFallback: false,
        fallbackNotice: '',
        suggestedPriority: safePriority,
        rationale: String(parsed.rationale || baseline.rationale).trim(),
        riskFactors:
          Array.isArray(parsed.riskFactors) && parsed.riskFactors.length > 0
            ? parsed.riskFactors.slice(0, 5)
            : baseline.riskFactors,
        trappedDetected: baseline.trappedDetected,
        humanReviewRequired: 'Yes',
        disclaimer:
          'AI-suggested dispatch priority only. Human Control Room review is mandatory before dispatch.',
      };
    }
  } catch {
    // Transparent fallback
  }

  return baseline;
}

// ============================================================================
// 4. TELUGU / HINDI / ENGLISH ON-DEMAND TRANSLATION
// ============================================================================

const EN_TO_TE_GLOSSARY = [
  [/residential flooding/gi, 'నివాస ప్రాంతాల వరద (Residential flooding)'],
  [/road waterlogging/gi, 'రోడ్డుపై నీరు నిలవడం (Road waterlogging)'],
  [/bridge blockage/gi, 'వంతెన మూసివేత (Bridge blockage)'],
  [/embankment breach/gi, 'గట్టు తెగడం (Embankment breach)'],
  [/drainage overflow/gi, 'డ్రైనేజీ పొంగిపొర్లడం (Drainage overflow)'],
  [/emergency/gi, 'అత్యవసర పరిస్థితి'],
  [/waterlogging/gi, 'నీరు నిలిచిపోవడం'],
  [/floodwater|flood water/gi, 'వరద నీరు'],
  [/flooding|flood/gi, 'వరద'],
  [/trapped|stranded/gi, 'చిక్కుకున్నారు'],
  [/evacuation|evacuate/gi, 'సురక్షిత ప్రాంతానికి తరలింపు'],
  [/rescue team/gi, 'రెస్క్యూ బృందం'],
  [/relief shelter|shelter/gi, 'పునరావాస కేంద్రం'],
  [/Rajahmundry/gi, 'రాజమండ్రి'],
  [/Dowleswaram/gi, 'ధవళేశ్వరం'],
  [/East Godavari/gi, 'తూర్పు గోదావరి'],
];

const TE_TO_EN_GLOSSARY = [
  [/వరద నీరు/g, 'flood water'],
  [/వరద/g, 'flood'],
  [/నీరు నిలిచింది|నీరు నిలిచిపోవడం/g, 'waterlogging'],
  [/చిక్కుకున్నాము|చిక్కుకున్నారు/g, 'trapped/stranded'],
  [/వంతెన|వారధి/g, 'bridge'],
  [/గట్టు|కట్ట/g, 'embankment'],
  [/రాజమండ్రి/g, 'Rajahmundry'],
  [/ధవళేశ్వరం/g, 'Dowleswaram'],
  [/తూర్పు గోదావరి/g, 'East Godavari'],
];

function ruleBasedTranslate(text, targetLanguage) {
  const original = String(text || '').trim();
  const isTeluguTarget = targetLanguage === 'te';
  const glossary = isTeluguTarget ? EN_TO_TE_GLOSSARY : TE_TO_EN_GLOSSARY;

  let transformed = original;
  let matchCount = 0;
  for (const [pattern, replacement] of glossary) {
    if (pattern.test(transformed)) {
      transformed = transformed.replace(pattern, replacement);
      matchCount += 1;
    }
  }

  const translatedText =
    matchCount > 0
      ? transformed
      : isTeluguTarget
      ? `[ప్రాథమిక నియమాల అనువాదం] ${original}`
      : `[Basic rule-based translation] ${original}`;

  return {
    origin: 'ai_suggested',
    usedFallback: true,
    fallbackNotice: AI_FALLBACK_NOTICE,
    originalText: original,
    translatedText,
    targetLanguage: isTeluguTarget ? 'te' : targetLanguage === 'hi' ? 'hi' : 'en',
    targetLanguageLabel:
      isTeluguTarget ? 'Telugu (తెలుగు)' : targetLanguage === 'hi' ? 'Hindi (हिन्दी)' : 'English',
    humanReviewRequired: 'Yes',
  };
}

export async function translateText({ text = '', targetLanguage = 'te' }) {
  const original = String(text || '').trim();
  const normalizedTarget = ['te', 'hi', 'en'].includes(targetLanguage) ? targetLanguage : 'en';
  const targetLabel =
    normalizedTarget === 'te'
      ? 'Telugu (తెలుగు)'
      : normalizedTarget === 'hi'
      ? 'Hindi (हिन्दी)'
      : 'English';

  if (!original) {
    return {
      origin: 'ai_suggested',
      usedFallback: false,
      fallbackNotice: '',
      originalText: '',
      translatedText: '',
      targetLanguage: normalizedTarget,
      targetLanguageLabel: targetLabel,
      humanReviewRequired: 'Yes',
    };
  }

  try {
    const parsed = await callServerAi('/translate', {
      text: original,
      targetLanguage: normalizedTarget,
    });
    if (parsed?.translatedText) {
      return {
        origin: 'ai_suggested',
        usedFallback: false,
        fallbackNotice: '',
        originalText: original,
        translatedText: String(parsed.translatedText).trim(),
        targetLanguage: normalizedTarget,
        targetLanguageLabel: targetLabel,
        humanReviewRequired: 'Yes',
      };
    }
  } catch {
    // Transparent fallback
  }

  return ruleBasedTranslate(original, normalizedTarget);
}

// ============================================================================
// 5. ADMIN AREA SUMMARY (Grounded Strictly in Real Stored Reports)
// ============================================================================

function buildRuleBasedAreaSummary({ areaLabel, scopedIncidents, scopedRequests }) {
  const reportCount = scopedIncidents.length;
  const emergencyCount = scopedRequests.length;
  const verifiedCount = scopedIncidents.filter((i) => i.status === 'verified').length;
  const pendingCount = scopedIncidents.filter((i) => i.status === 'pending_verification').length;
  const criticalCount = scopedIncidents.filter(
    (i) => (i.reviewed_priority || i.severity) === 'critical'
  ).length;
  const highCount = scopedIncidents.filter(
    (i) => (i.reviewed_priority || i.severity) === 'high'
  ).length;

  const categoryCounts = {};
  const locationSet = new Set();
  const referencedCodes = [];

  scopedIncidents.forEach((inc) => {
    const label = getIncidentCategoryLabel(inc.category);
    categoryCounts[label] = (categoryCounts[label] || 0) + 1;
    if (inc.locality) locationSet.add(inc.locality);
    if (inc.incident_code) referencedCodes.push(inc.incident_code);
  });

  scopedRequests.forEach((req) => {
    if (req.locality) locationSet.add(req.locality);
    if (req.request_code) referencedCodes.push(req.request_code);
  });

  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label, count]) => `${label} (${count})`);

  const activeEmergencyCount = scopedRequests.filter(
    (r) => !['resolved', 'closed', 'cancelled'].includes(r.status)
  ).length;
  const totalPeople = scopedRequests.reduce((sum, r) => sum + (Number(r.people_count) || 0), 0);

  let summaryText = '';
  if (reportCount === 0 && emergencyCount === 0) {
    summaryText = `No incident reports or emergency assistance requests are currently stored for ${areaLabel}.`;
  } else {
    const parts = [];
    parts.push(
      `Across ${areaLabel}, there are ${reportCount} stored flood point report(s) (${verifiedCount} admin-verified, ${pendingCount} pending verification)` +
        (criticalCount > 0 || highCount > 0
          ? `, including ${criticalCount} critical and ${highCount} high priority.`
          : '.')
    );
    if (topCategories.length > 0) {
      parts.push(`Primary reported hazard types: ${topCategories.join(', ')}.`);
    }
    if (emergencyCount > 0) {
      parts.push(
        `Emergency queue records ${emergencyCount} request(s) (${activeEmergencyCount} active, ${totalPeople} total residents listed).`
      );
    }
    if (referencedCodes.length > 0) {
      parts.push(`Referenced stored records: ${referencedCodes.slice(0, 10).join(', ')}.`);
    }
    summaryText = parts.join(' ');
  }

  return {
    origin: 'ai_suggested',
    usedFallback: true,
    fallbackNotice: AI_FALLBACK_NOTICE,
    areaLabel,
    reportCount,
    emergencyCount,
    verifiedCount,
    pendingCount,
    summaryText,
    keyLocations: Array.from(locationSet),
    topCategories,
    referencedCodes,
    humanReviewRequired: 'Yes',
    disclaimer:
      'Summary is generated strictly from stored database records in this area. Unverified citizen reports remain unconfirmed until Admin verification.',
  };
}

export async function summarizeAreaReports({
  areaLabel = 'All East Godavari',
  incidents = [],
  emergencyRequests = [],
}) {
  const isAll = !areaLabel || areaLabel === 'All East Godavari' || areaLabel === 'all';
  const scopedIncidents = isAll
    ? incidents
    : incidents.filter((i) => i.locality === areaLabel);
  const scopedRequests = isAll
    ? emergencyRequests
    : emergencyRequests.filter((r) => r.locality === areaLabel);

  const displayLabel = isAll ? 'All East Godavari' : areaLabel;
  const baseline = buildRuleBasedAreaSummary({
    areaLabel: displayLabel,
    scopedIncidents,
    scopedRequests,
  });

  if (scopedIncidents.length === 0 && scopedRequests.length === 0) {
    return {
      ...baseline,
      usedFallback: false,
      fallbackNotice: '',
    };
  }

  const sanitizedIncidents = scopedIncidents.map((i) => ({
    code: i.incident_code,
    category: getIncidentCategoryLabel(i.category),
    status: i.status,
    effectivePriority: i.reviewed_priority || i.severity,
    locality: i.locality,
    location: i.location_text,
    title: i.title,
    description: String(i.description || '').slice(0, 220),
  }));

  const sanitizedRequests = scopedRequests.map((r) => ({
    code: r.request_code,
    status: r.status,
    effectivePriority: r.reviewed_priority || r.severity,
    locality: r.locality,
    peopleCount: r.people_count,
    childrenCount: r.children_count || 0,
    elderlyCount: r.elderly_count || 0,
    hasMedicalNeed: Boolean(r.medical_needs && r.medical_needs.trim()),
  }));

  try {
    const parsed = await callServerAi('/area-summary', {
      areaLabel: displayLabel,
      incidents: sanitizedIncidents,
      emergencyRequests: sanitizedRequests,
    });
    if (parsed?.summaryText) {
      return {
        ...baseline,
        summaryText: String(parsed.summaryText).trim(),
        usedFallback: false,
        fallbackNotice: '',
      };
    }
  } catch {
    // Transparent fallback
  }

  return baseline;
}

export async function requestAiTriageSuggestion(payload = {}) {
  const result = await classifyIncident({
    title: payload.title || '',
    description: payload.description || '',
    locality: payload.locality || '',
    location_text: payload.location_text || '',
  });
  return {
    ...result,
    suggestedSeverity: result.suggestedUrgency,
    summary: result.shortSummary,
  };
}
