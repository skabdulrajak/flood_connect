import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const ALLOWED_CHAT_MODELS = new Set(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);
const DEFAULT_CHAT_MODEL = 'gemini-4-hydrogen';
const FAST_MODEL = 'gemini-3.1-flash-lite';
const LIVE_VOICE_MODEL = 'gemini-3.8-live';

function getGeminiApiKey(): string {
  return (process.env.GEMINI_API_KEY || '').trim();
}

function createAiClient(): GoogleGenAI | null {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildFloodConnectSystemInstruction(language = 'en', role = 'citizen', contextSummary = '') {
  const langName =
    language === 'te' ? 'Telugu (తెలుగు)' : language === 'hi' ? 'Hindi (हिन्दी)' : 'English';
  const base = [
    'You are the FloodConnect Emergency & Flood Coordination Assistant for East Godavari district, Andhra Pradesh, India (including Rajahmundry, Dowleswaram Barrage, Kadiam, Kovvur, Korukonda, Nidadavole, and nearby Godavari floodplains).',
    `Respond primarily in ${langName} unless the user writes in another language.`,
    `The signed-in user role is: ${role}. Tailor operational guidance appropriately.`,
    'CORE SAFETY RULES:',
    '1. Always prioritize human life safety. For immediate life-threatening emergencies, remind users of India emergency helplines: 112 (National Emergency), 108 (Ambulance), 101 (Fire), and encourage submitting an Emergency Help Request inside FloodConnect.',
    '2. NEVER fabricate live rainfall measurements, Godavari river levels, official government warnings, or shelter openings. Only cite live metrics if explicitly provided in the supplied workspace context.',
    '3. Keep answers structured, concise, calm, and actionable.',
  ];
  if (contextSummary) {
    base.push(`Current FloodConnect Workspace Snapshot (real records only):\n${contextSummary}`);
  }
  return base.join('\n');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      geminiConfigured: Boolean(getGeminiApiKey()),
      models: {
        chatDefault: DEFAULT_CHAT_MODEL,
        chatFast: FAST_MODEL,
        liveVoice: LIVE_VOICE_MODEL,
      },
    });
  });

  app.get('/api/emergency-snapshot', (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({
      district: 'East Godavari',
      state: 'Andhra Pradesh',
      updatedAt: new Date().toISOString(),
      helplines: [
        { number: '112', label: 'National Emergency' },
        { number: '108', label: 'Ambulance' },
        { number: '101', label: 'Fire & Rescue' },
        { number: '1077', label: 'District Emergency Control Room' },
      ],
      safetyChecklist: [
        'Move to higher ground or designated relief shelters immediately when water rises.',
        'Avoid walking or driving through moving floodwater or submerged roads.',
        'Disconnect electrical appliances and keep emergency medications and documents dry.',
        'Dial 112 (Emergency), 108 (Ambulance), or 101 (Fire) if anyone is trapped or injured.',
      ],
    });
  });

  app.post('/api/offline-reports/relay', (req, res) => {
    const { queueId = '', incidentCode = '', locality = 'East Godavari' } = req.body || {};
    res.json({
      received: true,
      queueId: String(queueId).slice(0, 120),
      incidentCode: String(incidentCode).slice(0, 64),
      locality: String(locality).slice(0, 120),
      syncedAt: new Date().toISOString(),
    });
  });

  // -------------------------------------------------------------------------
  // 1. Multi-Turn Gemini Chatbot
  // -------------------------------------------------------------------------
  app.post('/api/gemini/chat', async (req, res) => {
    const ai = createAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured on the server.',
        code: 'GEMINI_UNCONFIGURED',
      });
      return;
    }

    try {
      const {
        history = [],
        message = '',
        model = DEFAULT_CHAT_MODEL,
        language = 'en',
        role = 'citizen',
        contextSummary = '',
      } = req.body || {};

      const cleanMessage = String(message || '').trim();
      if (!cleanMessage) {
        res.status(400).json({ error: 'Message text is required.' });
        return;
      }

      const selectedModel = ALLOWED_CHAT_MODELS.has(model) ? model : DEFAULT_CHAT_MODEL;

      const sanitizedHistory = Array.isArray(history)
        ? history
            .filter(
              (turn) =>
                turn &&
                (turn.role === 'user' || turn.role === 'model') &&
                typeof turn.text === 'string' &&
                turn.text.trim().length > 0
            )
            .slice(-20)
            .map((turn) => ({
              role: turn.role,
              parts: [{ text: turn.text.slice(0, 4000) }],
            }))
        : [];

      const chat = ai.chats.create({
        model: selectedModel,
        history: sanitizedHistory,
        config: {
          systemInstruction: buildFloodConnectSystemInstruction(
            language,
            role,
            String(contextSummary || '').slice(0, 3000)
          ),
        },
      });

      const response = await chat.sendMessage({ message: cleanMessage.slice(0, 4000) });
      const reply = (response.text || '').trim();
      res.json({
        reply: reply || 'I could not generate a response right now. Please try rephrasing.',
        model: selectedModel,
      });
    } catch (err) {
      console.error('[/api/gemini/chat] Error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to generate chat response.',
      });
    }
  });

  // -------------------------------------------------------------------------
  // 2. Structured Incident Classification
  // -------------------------------------------------------------------------
  app.post('/api/gemini/classify', async (req, res) => {
    const ai = createAiClient();
    if (!ai) {
      res.status(503).json({ error: 'Gemini API unavailable', code: 'GEMINI_UNCONFIGURED' });
      return;
    }

    try {
      const { title = '', description = '', locality = '', location_text = '', validCategories = [] } =
        req.body || {};
      const categories =
        Array.isArray(validCategories) && validCategories.length > 0
          ? validCategories
          : [
              'residential_flooding',
              'road_waterlogging',
              'bridge_blockage',
              'embankment_breach',
              'drainage_overflow',
              'power_utility_hazard',
              'other',
            ];

      const prompt = [
        'You are an emergency flood triage assistant for East Godavari district, Andhra Pradesh, India.',
        'Classify the citizen-submitted flood report below using ONLY the provided text. Do NOT invent facts.',
        `Allowed categories: ${categories.join(', ')}`,
        'Allowed urgencies: low, medium, high, critical',
        `Headline: ${String(title).slice(0, 200) || 'Not provided'}`,
        `Locality: ${String(locality).slice(0, 120) || 'East Godavari'}`,
        `Location detail: ${String(location_text).slice(0, 200) || 'Not provided'}`,
        `Description: ${String(description).slice(0, 1500) || 'Not provided'}`,
        'Return concise extracted keywords (3 to 6) and a 1-2 sentence operational summary.',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: FAST_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestedCategory: { type: Type.STRING },
              suggestedUrgency: { type: Type.STRING },
              keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              shortSummary: { type: Type.STRING },
            },
            required: ['suggestedCategory', 'suggestedUrgency', 'keywords', 'shortSummary'],
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim());
      res.json(parsed);
    } catch (err) {
      console.error('[/api/gemini/classify] Error:', err);
      res.status(500).json({ error: 'Classification request failed.' });
    }
  });

  // -------------------------------------------------------------------------
  // 3. Duplicate Candidate Comparison Notes
  // -------------------------------------------------------------------------
  app.post('/api/gemini/duplicates', async (req, res) => {
    const ai = createAiClient();
    if (!ai) {
      res.status(503).json({ error: 'Gemini API unavailable', code: 'GEMINI_UNCONFIGURED' });
      return;
    }

    try {
      const { targetIncident, candidates = [] } = req.body || {};
      const prompt = [
        'Compare the target flood incident with the pre-scored candidate reports below.',
        'For each candidate, write one short factual sentence explaining why it may or may not describe the same event.',
        'Never recommend automatic deletion or auto-merging.',
        `Target: ${JSON.stringify(targetIncident).slice(0, 1000)}`,
        `Candidates JSON: ${JSON.stringify(candidates).slice(0, 2500)}`,
      ].join('\n');

      const response = await ai.models.generateContent({
        model: FAST_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              notes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    incidentCode: { type: Type.STRING },
                    note: { type: Type.STRING },
                  },
                  required: ['incidentCode', 'note'],
                },
              },
            },
            required: ['notes'],
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim());
      res.json(parsed);
    } catch (err) {
      console.error('[/api/gemini/duplicates] Error:', err);
      res.status(500).json({ error: 'Duplicate analysis failed.' });
    }
  });

  // -------------------------------------------------------------------------
  // 4. Emergency Priority Suggestion
  // -------------------------------------------------------------------------
  app.post('/api/gemini/priority', async (req, res) => {
    const ai = createAiClient();
    if (!ai) {
      res.status(503).json({ error: 'Gemini API unavailable', code: 'GEMINI_UNCONFIGURED' });
      return;
    }

    try {
      const payload = req.body || {};
      const prompt = [
        'You are an emergency flood triage advisor for East Godavari district, Andhra Pradesh.',
        'Suggest an advisory dispatch priority (low, medium, high, or critical) from these structured emergency parameters.',
        'Do NOT invent facts. Keep rationale to 1-2 clear sentences.',
        `Total people: ${Number(payload.people_count) || 1}`,
        `Children under 12: ${Number(payload.children_count) || 0}`,
        `Elderly 65+: ${Number(payload.elderly_count) || 0}`,
        `Trapped/unable to exit flag: ${payload.is_trapped ? 'Yes' : 'Not explicitly checked'}`,
        `Medical needs: ${String(payload.medical_needs || 'None reported').slice(0, 400)}`,
        `Accessibility/mobility needs: ${String(payload.accessibility_needs || 'None reported').slice(0, 400)}`,
        `Locality: ${String(payload.locality || 'East Godavari').slice(0, 120)}`,
        `Situation description: ${String(payload.description || 'Not provided').slice(0, 1200)}`,
      ].join('\n');

      const response = await ai.models.generateContent({
        model: FAST_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestedPriority: { type: Type.STRING },
              rationale: { type: Type.STRING },
              riskFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['suggestedPriority', 'rationale', 'riskFactors'],
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim());
      res.json(parsed);
    } catch (err) {
      console.error('[/api/gemini/priority] Error:', err);
      res.status(500).json({ error: 'Priority suggestion failed.' });
    }
  });

  // -------------------------------------------------------------------------
  // 5. On-Demand Translation (English / Hindi / Telugu)
  // -------------------------------------------------------------------------
  app.post('/api/gemini/translate', async (req, res) => {
    const ai = createAiClient();
    if (!ai) {
      res.status(503).json({ error: 'Gemini API unavailable', code: 'GEMINI_UNCONFIGURED' });
      return;
    }

    try {
      const { text = '', targetLanguage = 'te' } = req.body || {};
      const targetName =
        targetLanguage === 'te'
          ? 'Telugu (తెలుగు)'
          : targetLanguage === 'hi'
          ? 'Hindi (हिन्दी)'
          : 'English';

      const prompt = [
        `Translate the following flood response text into clear, accurate ${targetName}.`,
        'Preserve all numbers, measurements, incident/request IDs, and East Godavari place names accurately.',
        'Do NOT add extra commentary or invent details.',
        `Source text:\n"""\n${String(text).slice(0, 3000)}\n"""`,
      ].join('\n');

      const response = await ai.models.generateContent({
        model: FAST_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              translatedText: { type: Type.STRING },
            },
            required: ['translatedText'],
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim());
      res.json(parsed);
    } catch (err) {
      console.error('[/api/gemini/translate] Error:', err);
      res.status(500).json({ error: 'Translation failed.' });
    }
  });

  // -------------------------------------------------------------------------
  // 6. Grounded Admin Area Summary
  // -------------------------------------------------------------------------
  app.post('/api/gemini/area-summary', async (req, res) => {
    const ai = createAiClient();
    if (!ai) {
      res.status(503).json({ error: 'Gemini API unavailable', code: 'GEMINI_UNCONFIGURED' });
      return;
    }

    try {
      const { areaLabel = 'All East Godavari', incidents = [], emergencyRequests = [] } =
        req.body || {};

      const prompt = [
        `You are a disaster operations analyst writing a brief situational summary for District Admins in ${String(
          areaLabel
        ).slice(0, 120)}, Andhra Pradesh.`,
        'STRICT GROUNDING RULES:',
        '1. Summarize ONLY the real incident and emergency records supplied in the JSON below.',
        '2. NEVER invent incidents, casualties, rainfall numbers, river levels, or shelters.',
        '3. Clearly distinguish between Admin-verified incidents and pending_verification citizen reports.',
        '4. Cite exact incident/request codes (e.g., INC-..., ER-...) where relevant.',
        '5. Keep the summary concise (3 to 5 sentences).',
        `Incidents JSON: ${JSON.stringify(incidents).slice(0, 4000)}`,
        `Emergency Requests JSON: ${JSON.stringify(emergencyRequests).slice(0, 2500)}`,
      ].join('\n');

      const response = await ai.models.generateContent({
        model: DEFAULT_CHAT_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summaryText: { type: Type.STRING },
            },
            required: ['summaryText'],
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim());
      res.json(parsed);
    } catch (err) {
      console.error('[/api/gemini/area-summary] Error:', err);
      res.status(500).json({ error: 'Area summary failed.' });
    }
  });

  // -------------------------------------------------------------------------
  // Vite Dev Middleware or Static Production Build
  // -------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.webmanifest')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);

  // -------------------------------------------------------------------------
  // WebSocket Live Voice Proxy (/api/live -> gemini-3.8-live)
  // -------------------------------------------------------------------------
  const wss = new WebSocketServer({ server, path: '/api/live' });

  wss.on('connection', async (clientWs: WebSocket, req) => {
    const ai = createAiClient();
    if (!ai) {
      clientWs.send(
        JSON.stringify({
          error: 'Gemini API key is not configured on the server for Live Voice.',
        })
      );
      clientWs.close();
      return;
    }

    const reqUrl = new URL(req.url || '/api/live', `http://${req.headers.host || 'localhost'}`);
    const language = reqUrl.searchParams.get('lang') || 'en';
    const role = reqUrl.searchParams.get('role') || 'citizen';

    let liveSession: Awaited<ReturnType<typeof ai.live.connect>> | null = null;
    let isClosed = false;

    try {
      liveSession = await ai.live.connect({
        model: LIVE_VOICE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: {
            parts: [
              {
                text: `${buildFloodConnectSystemInstruction(
                  language,
                  role
                )}\nSpeak concisely and clearly as a live voice responder (2-4 short spoken sentences per turn).`,
              },
            ],
          },
        },
        callbacks: {
          onopen: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ ready: true, model: LIVE_VOICE_MODEL }));
            }
          },
          onmessage: (msg) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;

            if (msg.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }

            if (msg.serverContent?.inputTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  inputTranscript: msg.serverContent.inputTranscription.text,
                })
              );
            }

            if (msg.serverContent?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  outputTranscript: msg.serverContent.outputTranscription.text,
                })
              );
            }

            const parts = msg.serverContent?.modelTurn?.parts || [];
            for (const part of parts) {
              if (part.inlineData?.data) {
                clientWs.send(
                  JSON.stringify({
                    audio: part.inlineData.data,
                    mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000',
                  })
                );
              }
            }

            if (msg.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            }
          },
          onerror: (err) => {
            console.error('[/api/live] Gemini Live error:', err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  error: 'Live voice session encountered a connection error.',
                })
              );
            }
          },
          onclose: () => {
            if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ closed: true }));
              clientWs.close();
            }
          },
        },
      });
    } catch (err) {
      console.error('[/api/live] Failed to connect to Gemini Live:', err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            error:
              err instanceof Error
                ? err.message
                : 'Unable to establish Gemini Live Voice session.',
          })
        );
        clientWs.close();
      }
      return;
    }

    clientWs.on('message', (raw) => {
      if (!liveSession || isClosed) return;
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.audio && typeof msg.audio === 'string') {
          liveSession.sendRealtimeInput({
            audio: {
              data: msg.audio,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } else if (msg.text && typeof msg.text === 'string') {
          liveSession.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: msg.text.slice(0, 2000) }] }],
            turnComplete: true,
          });
        }
      } catch (err) {
        console.error('[/api/live] Message parse error:', err);
      }
    });

    clientWs.on('close', () => {
      isClosed = true;
      try {
        liveSession?.close();
      } catch {
        // Ignore cleanup errors
      }
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`FloodConnect server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
