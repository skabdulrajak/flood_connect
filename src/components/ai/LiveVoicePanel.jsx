import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Radio,
  Volume2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

function float32ToPcm16Base64(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return window.btoa(binary);
}

function pcm16Base64ToFloat32(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const samples = Math.floor(bytes.length / 2);
  const out = new Float32Array(samples);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples; i += 1) {
    out[i] = view.getInt16(i * 2, true) / 32768;
  }
  return out;
}

export function LiveVoicePanel() {
  const { t, i18n } = useTranslation();
  const { role } = useAuth();

  const [status, setStatus] = useState('idle'); // idle | connecting | live | error
  const [muted, setMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [inputLevel, setInputLevel] = useState(0);
  const [transcripts, setTranscripts] = useState([]);

  const wsRef = useRef(null);
  const micStreamRef = useRef(null);
  const captureCtxRef = useRef(null);
  const processorRef = useRef(null);
  const playbackCtxRef = useRef(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef([]);
  const mutedRef = useRef(false);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const stopPlaybackQueue = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {
        // already stopped
      }
    });
    activeSourcesRef.current = [];
    if (playbackCtxRef.current) {
      nextStartTimeRef.current = playbackCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
  }, []);

  const schedulePcmPlayback = useCallback((base64Pcm) => {
    const ctx = playbackCtxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const floats = pcm16Base64ToFloat32(base64Pcm);
    if (floats.length === 0) return;

    const audioBuffer = ctx.createBuffer(1, floats.length, 24000);
    audioBuffer.copyToChannel(floats, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime + 0.015, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + audioBuffer.duration;
    activeSourcesRef.current.push(source);
    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
    };
  }, []);

  const appendTranscript = useCallback((speaker, chunk) => {
    const text = String(chunk || '');
    if (!text) return;
    setTranscripts((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].speaker === speaker) {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          text: `${updated[updated.length - 1].text}${text}`,
        };
        return updated;
      }
      return [
        ...prev.slice(-24),
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          speaker,
          text,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ];
    });
  }, []);

  const disconnect = useCallback(() => {
    stopPlaybackQueue();
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current = null;
    }
    if (captureCtxRef.current) {
      void captureCtxRef.current.close().catch(() => {});
      captureCtxRef.current = null;
    }
    if (playbackCtxRef.current) {
      void playbackCtxRef.current.close().catch(() => {});
      playbackCtxRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((tr) => tr.stop());
      micStreamRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
    setInputLevel(0);
    setStatus('idle');
  }, [stopPlaybackQueue]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const startVoiceSession = async () => {
    setErrorMsg('');
    setStatus('connecting');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          t('assistant.micUnsupported', {
            defaultValue: 'Microphone access is not supported in this browser.',
          })
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const captureCtx = new AudioCtx({ sampleRate: 16000 });
      const playbackCtx = new AudioCtx({ sampleRate: 24000 });
      captureCtxRef.current = captureCtx;
      playbackCtxRef.current = playbackCtx;
      nextStartTimeRef.current = playbackCtx.currentTime;

      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const lang = ['en', 'hi', 'te'].includes(i18n.language) ? i18n.language : 'en';
      const wsUrl = `${wsProto}//${window.location.host}/api/live?lang=${encodeURIComponent(
        lang
      )}&role=${encodeURIComponent(role || 'citizen')}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        const source = captureCtx.createMediaStreamSource(stream);
        const processor = captureCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (ev) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const input = ev.inputBuffer.getChannelData(0);

          let sumSq = 0;
          for (let i = 0; i < input.length; i += 1) {
            sumSq += input[i] * input[i];
          }
          const rms = Math.sqrt(sumSq / input.length);
          setInputLevel(mutedRef.current ? 0 : Math.min(100, Math.round(rms * 320)));

          if (mutedRef.current) return;
          const base64Pcm = float32ToPcm16Base64(input);
          ws.send(JSON.stringify({ audio: base64Pcm }));
        };

        source.connect(processor);
        processor.connect(captureCtx.destination);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.ready) {
            setStatus('live');
            return;
          }
          if (msg.error) {
            setErrorMsg(String(msg.error));
            setStatus('error');
            disconnect();
            return;
          }
          if (msg.interrupted) {
            stopPlaybackQueue();
          }
          if (msg.inputTranscript) {
            appendTranscript('user', msg.inputTranscript);
          }
          if (msg.outputTranscript) {
            appendTranscript('assistant', msg.outputTranscript);
          }
          if (msg.audio) {
            schedulePcmPlayback(msg.audio);
          }
          if (msg.closed) {
            disconnect();
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onerror = () => {
        setErrorMsg(
          t('assistant.voiceConnectionError', {
            defaultValue: 'Unable to connect to the Live Voice service. Please try again.',
          })
        );
        setStatus('error');
        disconnect();
      };

      ws.onclose = () => {
        setStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
      };
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : t('assistant.micPermissionError', {
              defaultValue: 'Microphone permission was denied or unavailable.',
            })
      );
      setStatus('error');
      disconnect();
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#0B2545] text-[#13A89E]">
              <Radio className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-[#0B2545]">
                {t('assistant.liveVoiceTitle', {
                  defaultValue: 'Real-Time Emergency Voice Responder (Gemini Live)',
                })}
              </h3>
              <p className="mt-0.5 text-xs text-slate-600">
                {t('assistant.liveVoiceSubtitle', {
                  defaultValue:
                    'Hands-free two-way voice guidance in English, Hindi, or Telugu for flood safety, shelter directions, and emergency triage.',
                })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {status === 'idle' || status === 'error' ? (
              <button
                type="button"
                onClick={startVoiceSession}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#13A89E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0E857D] transition-colors"
              >
                <PhoneCall className="h-4 w-4" aria-hidden="true" />
                <span>{t('assistant.startVoice', { defaultValue: 'Start Live Voice' })}</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  className={`inline-flex min-h-[42px] items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${
                    muted
                      ? 'border-amber-300 bg-amber-50 text-amber-800'
                      : 'border-slate-300 bg-white text-[#0B2545] hover:bg-slate-50'
                  }`}
                >
                  {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4 text-[#13A89E]" />}
                  <span>
                    {muted
                      ? t('assistant.unmute', { defaultValue: 'Unmute' })
                      : t('assistant.mute', { defaultValue: 'Mute Mic' })}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={disconnect}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
                >
                  <PhoneOff className="h-4 w-4" aria-hidden="true" />
                  <span>{t('assistant.endVoice', { defaultValue: 'End Call' })}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Static Session Status & Audio Input Meter */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-[#F4F6F8] px-4 py-3 text-xs">
          <div className="flex items-center gap-2 font-medium text-[#0B2545]">
            <Volume2 className="h-4 w-4 text-[#13A89E]" aria-hidden="true" />
            <span>
              {status === 'live'
                ? t('assistant.voiceStatusLive', { defaultValue: 'Connected · Listening & Speaking (24kHz Audio)' })
                : status === 'connecting'
                ? t('assistant.voiceStatusConnecting', { defaultValue: 'Connecting to Gemini 3.8 Live...' })
                : t('assistant.voiceStatusIdle', { defaultValue: 'Ready · Click Start Live Voice and allow microphone access' })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">
              {t('assistant.micLevel', { defaultValue: 'Mic Level' })}
            </span>
            <div className="h-2 w-28 overflow-hidden rounded bg-slate-200">
              <div
                className="h-full bg-[#13A89E] transition-all duration-75"
                style={{ width: `${inputLevel}%` }}
              />
            </div>
          </div>
        </div>

        {errorMsg ? (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        ) : null}
      </div>

      {/* Live Voice Transcript Log */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {t('assistant.liveTranscriptHeading', { defaultValue: 'Live Conversation Transcript' })}
          </h4>
          {transcripts.length > 0 ? (
            <button
              type="button"
              onClick={() => setTranscripts([])}
              className="text-xs font-medium text-slate-500 hover:text-[#0B2545]"
            >
              {t('common.clear', { defaultValue: 'Clear' })}
            </button>
          ) : null}
        </div>

        <div className="max-h-72 overflow-y-auto p-4 space-y-3">
          {transcripts.length === 0 ? (
            <p className="text-center text-xs text-slate-500 py-8">
              {t('assistant.liveTranscriptEmpty', {
                defaultValue:
                  'Spoken captions from you and the FloodConnect Voice Assistant will appear here during an active call.',
              })}
            </p>
          ) : (
            transcripts.map((item) => (
              <div
                key={item.id}
                className={`flex flex-col ${
                  item.speaker === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3.5 py-2 text-sm leading-relaxed ${
                    item.speaker === 'user'
                      ? 'bg-[#0B2545] text-white'
                      : 'border border-slate-200 bg-[#F4F6F8] text-[#0B2545]'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{item.text}</p>
                  <span
                    className={`mt-1 block text-[10px] ${
                      item.speaker === 'user' ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {item.speaker === 'user'
                      ? t('assistant.youLabel', { defaultValue: 'You' })
                      : t('assistant.botLabel', { defaultValue: 'FloodConnect Voice' })}{' '}
                    · {item.time}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
