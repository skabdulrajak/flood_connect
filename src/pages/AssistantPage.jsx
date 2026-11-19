import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Bot,
  Loader2,
  MessageSquare,
  Radio,
  Send,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { dataService } from '../services/dataService';
import {
  GEMINI_FAST_MODEL,
  GEMINI_MODEL,
  sendAssistantChatMessage,
} from '../services/aiService';
import { LiveVoicePanel } from '../components/ai/LiveVoicePanel';

export function AssistantPage() {
  const { t, i18n } = useTranslation();
  const { user, profile, role, isFirebaseMode } = useAuth();

  const [activeTab, setActiveTab] = useState('chat'); // chat | voice
  const [selectedModel, setSelectedModel] = useState(GEMINI_MODEL);
  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [workspaceContext, setWorkspaceContext] = useState('');

  const bottomRef = useRef(null);

  useEffect(() => {
    let active = true;
    async function loadInitial() {
      setLoadingHistory(true);
      try {
        const [history, summary] = await Promise.all([
          user?.id ? dataService.getChatMessages(user.id) : Promise.resolve([]),
          dataService.getPublicSummary().catch(() => null),
        ]);
        if (!active) return;
        setMessages(Array.isArray(history) ? history : []);
        if (summary) {
          setWorkspaceContext(
            `Active alerts: ${summary.activeAlerts ?? 0}, Open relief shelters: ${
              summary.openShelters ?? 0
            }, Verified flood reports: ${summary.verifiedIncidents ?? 0}, User locality: ${
              profile?.locality || 'East Godavari'
            }.`
          );
        }
      } catch {
        if (active) setMessages([]);
      } finally {
        if (active) setLoadingHistory(false);
      }
    }
    loadInitial();
    return () => {
      active = false;
    };
  }, [user?.id, profile?.locality]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleSend = async (promptOverride = '') => {
    const text = (promptOverride || inputText).trim();
    if (!text || sending) return;

    setErrorMsg('');
    if (!promptOverride) setInputText('');
    setSending(true);

    const optimisticUserMsg = {
      id: `local_u_${Date.now()}`,
      role: 'user',
      text,
      model: selectedModel,
      created_at: new Date().toISOString(),
    };
    const priorHistory = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, optimisticUserMsg]);

    try {
      if (user?.id) {
        await dataService.saveChatMessage(user.id, {
          role: 'user',
          text,
          model: selectedModel,
        });
      }

      const res = await sendAssistantChatMessage({
        history: priorHistory,
        message: text,
        model: selectedModel,
        language: i18n.language || 'en',
        role: role || 'citizen',
        contextSummary: workspaceContext,
      });

      const replyText = res?.reply || 'No response received.';
      const modelMsg = {
        id: `local_m_${Date.now()}`,
        role: 'model',
        text: replyText,
        model: res?.model || selectedModel,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, modelMsg]);

      if (user?.id) {
        await dataService.saveChatMessage(user.id, {
          role: 'model',
          text: replyText,
          model: res?.model || selectedModel,
        });
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : t('assistant.chatError', { defaultValue: 'Unable to reach Gemini Assistant right now.' })
      );
    } finally {
      setSending(false);
    }
  };

  const handleClearChat = async () => {
    setMessages([]);
    setErrorMsg('');
    if (user?.id) {
      await dataService.clearChatMessages(user.id).catch(() => {});
    }
  };

  const quickPrompts = [
    t('assistant.promptSafety', {
      defaultValue: 'What immediate steps should a family take if floodwater enters the ground floor?',
    }),
    t('assistant.promptKit', {
      defaultValue: 'Give me a concise East Godavari monsoon emergency evacuation checklist.',
    }),
    t('assistant.promptTriage', {
      defaultValue: 'How should I prioritize reporting a submerged bridge vs. a trapped household?',
    }),
  ];

  return (
    <div className="space-y-4">
      {/* Header + Mode Tabs */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-[#0B2545]">
            {t('assistant.pageTitle', { defaultValue: 'FloodConnect AI Assistant & Live Voice' })}
          </h2>
          <p className="text-xs text-slate-600">
            {t('assistant.pageSubtitle', {
              defaultValue:
                'Multi-turn flood guidance powered by Gemini and real-time hands-free voice assistance.',
            })}
            {isFirebaseMode ? ' · Firestore history synced' : ''}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Assistant mode"
          className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-[#F4F6F8] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'chat'}
            onClick={() => setActiveTab('chat')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'chat'
                ? 'bg-[#0B2545] text-white'
                : 'text-slate-600 hover:text-[#0B2545]'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('assistant.tabChat', { defaultValue: 'Multi-Turn Chat' })}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'voice'}
            onClick={() => setActiveTab('voice')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'voice'
                ? 'bg-[#13A89E] text-white'
                : 'text-slate-600 hover:text-[#0B2545]'
            }`}
          >
            <Radio className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('assistant.tabVoice', { defaultValue: 'Live Voice (Audio)' })}</span>
          </button>
        </div>
      </div>

      {/* Advisory Safety Notice */}
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-xs text-[#0B2545]">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#C06310]" aria-hidden="true" />
        <p>
          {t('assistant.safetyBanner', {
            defaultValue:
              'AI guidance is advisory only and never replaces official District Control Room directives. For immediate life-threatening emergencies call 112 (Emergency), 108 (Ambulance), or 101 (Fire).',
          })}
        </p>
      </div>

      {activeTab === 'voice' ? (
        <LiveVoicePanel />
      ) : (
        <div className="flex h-[calc(100vh-19rem)] min-h-[460px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
          {/* Chat Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-[#F4F6F8] px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs">
              <Bot className="h-4 w-4 text-[#13A89E]" aria-hidden="true" />
              <label htmlFor="chat-model-select" className="font-semibold text-[#0B2545]">
                {t('assistant.modelLabel', { defaultValue: 'Model' })}:
              </label>
              <select
                id="chat-model-select"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-[#0B2545] focus:border-[#13A89E] focus:outline-none"
              >
                <option value={GEMINI_MODEL}>
                  gemini-4-hydrogen ({t('assistant.modelStandard', { defaultValue: 'Standard' })})
                </option>
                <option value={GEMINI_FAST_MODEL}>
                  gemini-3.1-flash-lite ({t('assistant.modelFast', { defaultValue: 'Fast' })})
                </option>
              </select>
            </div>

            {messages.length > 0 ? (
              <button
                type="button"
                onClick={handleClearChat}
                className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-red-300 hover:text-red-700 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t('assistant.clearHistory', { defaultValue: 'Clear Chat' })}</span>
              </button>
            ) : null}
          </div>

          {/* Scrollable Message Thread */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loadingHistory ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#13A89E]" />
                {t('common.loading')}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center max-w-lg mx-auto space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0B2545] text-[#13A89E]">
                  <Bot className="h-6 w-6" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-[#0B2545]">
                    {t('assistant.emptyTitle', {
                      defaultValue: 'Ask FloodConnect Emergency & Coordination Advisor',
                    })}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    {t('assistant.emptyBody', {
                      defaultValue:
                        'Ask about flood evacuation safety, relief preparation, reporting guidance, or emergency triage in English, Hindi, or Telugu.',
                    })}
                  </p>
                </div>
                <div className="grid w-full gap-2">
                  {quickPrompts.map((qp) => (
                    <button
                      key={qp}
                      type="button"
                      onClick={() => handleSend(qp)}
                      className="rounded-lg border border-slate-200 bg-[#F4F6F8] px-3.5 py-2.5 text-left text-xs font-medium text-[#0B2545] hover:border-[#13A89E] hover:bg-white transition-colors"
                    >
                      {qp}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#0B2545] text-white'
                        : 'border border-slate-200 bg-[#F4F6F8] text-[#0B2545]'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <div
                      className={`mt-1.5 flex items-center gap-2 text-[10px] ${
                        msg.role === 'user' ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      <span>
                        {msg.role === 'user'
                          ? profile?.full_name || t('assistant.youLabel', { defaultValue: 'You' })
                          : `FloodConnect AI · ${msg.model || selectedModel}`}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}

            {sending ? (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-[#F4F6F8] px-4 py-2.5 text-xs text-slate-600">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#13A89E]" />
                  <span>{t('assistant.thinking', { defaultValue: 'Generating guidance...' })}</span>
                </div>
              </div>
            ) : null}

            <div ref={bottomRef} />
          </div>

          {errorMsg ? (
            <div
              role="alert"
              className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          ) : null}

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 border-t border-slate-200 bg-white p-3"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={sending}
              placeholder={t('assistant.inputPlaceholder', {
                defaultValue: 'Ask a flood safety, shelter, or coordination question...',
              })}
              aria-label={t('assistant.inputPlaceholder', {
                defaultValue: 'Ask a flood safety, shelter, or coordination question...',
              })}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#0B2545] placeholder:text-slate-400 focus:border-[#13A89E] focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={sending || !inputText.trim()}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg bg-[#0B2545] px-4 py-2 text-sm font-semibold text-white hover:bg-[#13315C] transition-colors disabled:opacity-50"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t('common.send', { defaultValue: 'Send' })}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
