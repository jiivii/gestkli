/**
 * useVoiceTranscription
 * ─────────────────────
 * Hook modular para dictado híbrido:
 *   1. Web Speech API → transcripción en tiempo real (interim)
 *   2. MediaRecorder   → captura del blob de audio
 *   3. Vercel Serverless Function `/api/transcribe` → Whisper (alta precisión)
 *   4. Diccionario médico → correcciones de términos
 *
 * No modifica ninguna otra parte de la aplicación.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ──────────────────────────────────────────────────────────────
// Diccionario de correcciones médicas (ampliar según necesidad)
// ──────────────────────────────────────────────────────────────
const MEDICAL_DICTIONARY: Record<string, string> = {
  // Síntomas frecuentes
  'disnea': 'disnea',
  'dispnea': 'disnea',
  'dispneia': 'disnea',
  'taquicardia': 'taquicardia',
  'bradicardia': 'bradicardia',
  'hipertension': 'hipertensión',
  'hipotension': 'hipotensión',
  'fiebre alta': 'fiebre alta',
  'temperatura': 'temperatura',
  'cefalea': 'cefalea',
  'migraña': 'migraña',
  // Términos mal pronunciados / coloquiales → técnicos
  'infarto': 'infarto agudo de miocardio',
  'iam': 'IAM',
  'epoc': 'EPOC',
  'diabetes tipo 2': 'diabetes mellitus tipo 2',
  'tensión alta': 'hipertensión arterial',
  'azúcar alta': 'hiperglucemia',
  'reacción alérgica': 'reacción alérgica',
  // Medicamentos comunes
  'ibuprofeno': 'ibuprofeno',
  'paracetamol': 'paracetamol',
  'omeprazol': 'omeprazol',
  'atorvastatina': 'atorvastatina',
  'metformina': 'metformina',
};

function applyMedicalCorrections(text: string): string {
  let result = text;
  Object.entries(MEDICAL_DICTIONARY).forEach(([wrong, correct]) => {
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
    result = result.replace(regex, correct);
  });
  return result;
}

// ──────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────
export type TranscriptionStatus =
  | 'idle'
  | 'recording'
  | 'processing'
  | 'done'
  | 'error';

export interface UseVoiceTranscriptionOptions {
  /** Idioma para Web Speech API. Por defecto 'es-ES' */
  lang?: string;
  /** Callback cuando la transcripción final está lista */
  onTranscriptionReady?: (text: string) => void;
}

export interface UseVoiceTranscriptionReturn {
  status: TranscriptionStatus;
  interimText: string;
  finalText: string;
  errorMessage: string | null;
  isSupported: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  reset: () => void;
}

// ──────────────────────────────────────────────────────────────
// Detección de soporte
// ──────────────────────────────────────────────────────────────
const SpeechRecognitionAPI =
  (window as any).SpeechRecognition ||
  (window as any).webkitSpeechRecognition;

const isWebSpeechSupported = !!SpeechRecognitionAPI;
const isMediaRecorderSupported =
  typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

// ──────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────
export function useVoiceTranscription({
  lang = 'es-ES',
  onTranscriptionReady,
}: UseVoiceTranscriptionOptions = {}): UseVoiceTranscriptionReturn {

  const [status, setStatus] = useState<TranscriptionStatus>('idle');
  const [interimText, setInterimText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs para no recrear closures en callbacks
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const accumulatedFinalRef = useRef<string>('');
  const streamRef = useRef<MediaStream | null>(null);

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setInterimText('');
    setFinalText('');
    setErrorMessage(null);
    accumulatedFinalRef.current = '';
    audioChunksRef.current = [];
  }, []);

  const sendToWhisper = useCallback(
    async (audioBlob: Blob) => {
      setStatus('processing');

      const formData = new FormData();
      // Whisper acepta webm, mp4, wav, etc.
      formData.append('audio', audioBlob, 'recording.webm');

      try {
        const res = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        const corrected = applyMedicalCorrections(data.text || '');

        setFinalText(corrected);
        setInterimText('');
        setStatus('done');
        onTranscriptionReady?.(corrected);
      } catch (err: any) {
        console.error('[Whisper] Error:', err);
        // Fallback: usar la transcripción en tiempo real si Whisper falla
        const fallback = applyMedicalCorrections(accumulatedFinalRef.current);
        if (fallback) {
          setFinalText(fallback);
          setStatus('done');
          onTranscriptionReady?.(fallback);
          setErrorMessage('Whisper no disponible. Usando transcripción del navegador.');
        } else {
          setStatus('error');
          setErrorMessage(`Error de transcripción: ${err.message}`);
        }
      }
    },
    [onTranscriptionReady]
  );

  const startRecording = useCallback(async () => {
    if (status === 'recording') return;
    reset();

    // ── 1. Permisos de micrófono ──────────────────────────────
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch (err: any) {
      setStatus('error');
      if (err.name === 'NotAllowedError') {
        setErrorMessage('Permiso de micrófono denegado. Actívalo en la configuración del navegador.');
      } else {
        setErrorMessage('No se pudo acceder al micrófono.');
      }
      return;
    }

    // ── 2. MediaRecorder ─────────────────────────────────────
    if (isMediaRecorderSupported) {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        sendToWhisper(blob);
      };

      recorder.start(250); // chunks cada 250ms
      mediaRecorderRef.current = recorder;
    }

    // ── 3. Web Speech API (tiempo real) ──────────────────────
    if (isWebSpeechSupported) {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = lang;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            accumulatedFinalRef.current += t + ' ';
          } else {
            interim += t;
          }
        }
        setInterimText(accumulatedFinalRef.current + interim);
      };

      recognition.onerror = (event: any) => {
        // 'no-speech' es normal, no es un error crítico
        if (event.error !== 'no-speech') {
          console.warn('[SpeechRecognition] error:', event.error);
        }
      };

      recognition.onend = () => {
        // Si sigue grabando, reiniciar reconocimiento (Chrome lo para automáticamente)
        if (mediaRecorderRef.current?.state === 'recording') {
          try { recognition.start(); } catch (_) {}
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    }

    setStatus('recording');
  }, [status, reset, lang, sendToWhisper]);

  const stopRecording = useCallback(() => {
    if (status !== 'recording') return;

    // Detener Speech Recognition
    try { recognitionRef.current?.stop(); } catch (_) {}
    recognitionRef.current = null;

    // Detener MediaRecorder → dispara onstop → sendToWhisper
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
      // Si no hay MediaRecorder, usar fallback de Web Speech
      const fallback = applyMedicalCorrections(accumulatedFinalRef.current.trim());
      setFinalText(fallback);
      setStatus('done');
      onTranscriptionReady?.(fallback);
      streamRef.current?.getTracks().forEach(t => t.stop());
    }
  }, [status, onTranscriptionReady]);

  return {
    status,
    interimText,
    finalText,
    errorMessage,
    isSupported: isWebSpeechSupported || isMediaRecorderSupported,
    startRecording,
    stopRecording,
    reset,
  };
}
