import i18n from '../i18n';

/**
 * Environment configuration parser for FloodConnect.
 * Reads ONLY Vite-exposed public environment variables.
 * Never hardcode API keys or expose a Supabase service_role key in client code.
 */

const rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawSupabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const rawGeminiApiKey = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
const rawDemoMode = String(import.meta.env.VITE_DEMO_MODE ?? '').trim().toLowerCase();
const rawAiBackendUrl = (import.meta.env.VITE_AI_BACKEND_URL || '').trim();

const hasSupabaseUrl = Boolean(rawSupabaseUrl);
const hasSupabaseAnonKey = Boolean(rawSupabaseAnonKey);
const hasSupabaseConfig = hasSupabaseUrl && hasSupabaseAnonKey;
const hasGeminiConfig = Boolean(rawGeminiApiKey) || Boolean(rawAiBackendUrl);

const explicitDemoMode = rawDemoMode === 'true';
const explicitLiveMode = rawDemoMode === 'false';

// Missing credentials list with exact variable names for transparent banners
const missingSupabaseVars = [];
if (!hasSupabaseUrl) missingSupabaseVars.push('VITE_SUPABASE_URL');
if (!hasSupabaseAnonKey) missingSupabaseVars.push('VITE_SUPABASE_ANON_KEY');

const missingAiVars = [];
if (!hasGeminiConfig) missingAiVars.push('VITE_GEMINI_API_KEY');

const allMissingVars = [...missingSupabaseVars, ...missingAiVars];

// Effective mode: Demo mode if explicitly requested OR if Supabase credentials are missing
const isDemoFallback = !explicitDemoMode && !hasSupabaseConfig;
const isDemoMode = explicitDemoMode || !hasSupabaseConfig;

export const envConfig = Object.freeze({
  supabaseUrl: rawSupabaseUrl,
  supabaseAnonKey: rawSupabaseAnonKey,
  geminiApiKey: rawGeminiApiKey,
  aiBackendUrl: rawAiBackendUrl,
  explicitDemoMode,
  explicitLiveMode,
  hasSupabaseConfig,
  hasGeminiConfig,
  isDemoMode,
  isDemoFallback,
  missingSupabaseVars,
  missingAiVars,
  allMissingVars,
  activeDataLayer: isDemoMode ? 'demo' : 'supabase',
});

export function getConfigDiagnosticItems() {
  return [
    {
      name: 'VITE_SUPABASE_URL',
      configured: hasSupabaseUrl,
      purpose: i18n.t('demo.purposeSupabaseUrl'),
    },
    {
      name: 'VITE_SUPABASE_ANON_KEY',
      configured: hasSupabaseAnonKey,
      purpose: i18n.t('demo.purposeSupabaseKey'),
    },
    {
      name: 'VITE_GEMINI_API_KEY',
      configured: Boolean(rawGeminiApiKey),
      purpose: i18n.t('demo.purposeGeminiKey'),
    },
    {
      name: 'VITE_DEMO_MODE',
      configured: rawDemoMode === 'true' || rawDemoMode === 'false',
      value:
        rawDemoMode === 'true'
          ? i18n.t('demo.enabled')
          : rawDemoMode === 'false'
            ? i18n.t('demo.disabled')
            : i18n.t('demo.missing'),
      purpose: i18n.t('demo.purposeDemoMode'),
    },
  ];
}
