/**
 * VoiceDictation
 * ──────────────
 * Componente UI aislado para dictado por voz.
 * Se monta junto al textarea de "Nueva Nota Médica" en PatientDetail.
 *
 * Props:
 *   onTranscriptionReady(text)  → inyecta el texto final en el formulario padre
 *   backendBaseUrl              → URL base del backend (opcional)
 */

import React, { useEffect } from 'react';
import { Mic, MicOff, Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useVoiceTranscription } from '../hooks/useVoiceTranscription';

interface VoiceDictationProps {
  onTranscriptionReady: (text: string) => void;
}

const VoiceDictation: React.FC<VoiceDictationProps> = ({
  onTranscriptionReady,
}) => {
  const {
    status,
    interimText,
    errorMessage,
    isSupported,
    startRecording,
    stopRecording,
    reset,
  } = useVoiceTranscription({ onTranscriptionReady });

  // Auto-limpiar el estado "done" tras 4 segundos
  useEffect(() => {
    if (status === 'done') {
      const t = setTimeout(reset, 4000);
      return () => clearTimeout(t);
    }
  }, [status, reset]);

  const isRecording = status === 'recording';
  const isProcessing = status === 'processing';
  const isDone = status === 'done';
  const isError = status === 'error';

  const handleToggle = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  // ─── Estilos inline (aislados) ───────────────────────────────
  const styles: Record<string, React.CSSProperties> = {
    wrapper: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      marginTop: '8px',
    },
    row: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      flexWrap: 'wrap',
    },
    micBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: '7px',
      padding: '8px 16px',
      borderRadius: '999px',
      border: 'none',
      cursor: isProcessing ? 'not-allowed' : 'pointer',
      fontWeight: 600,
      fontSize: '13px',
      transition: 'all 0.2s ease',
      outline: 'none',
      boxShadow: isRecording
        ? '0 0 0 4px rgba(239,68,68,0.2)'
        : '0 1px 3px rgba(0,0,0,0.12)',
      background: isRecording
        ? 'linear-gradient(135deg,#ef4444,#dc2626)'
        : isProcessing
        ? 'linear-gradient(135deg,#8b5cf6,#7c3aed)'
        : isDone
        ? 'linear-gradient(135deg,#10b981,#059669)'
        : 'linear-gradient(135deg,#6366f1,#4f46e5)',
      color: '#fff',
      animation: isRecording ? 'vd-pulse 1.4s ease-in-out infinite' : 'none',
      opacity: isProcessing ? 0.8 : 1,
    } as React.CSSProperties,
    interimBox: {
      background: 'rgba(99,102,241,0.06)',
      border: '1px dashed rgba(99,102,241,0.35)',
      borderRadius: '8px',
      padding: '8px 12px',
      fontSize: '13px',
      color: '#4f46e5',
      lineHeight: '1.5',
      fontStyle: 'italic',
      minHeight: '36px',
    },
    statusBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      fontSize: '12px',
      fontWeight: 500,
      padding: '3px 10px',
      borderRadius: '999px',
      background: isError
        ? '#fee2e2'
        : isDone
        ? '#d1fae5'
        : isProcessing
        ? '#ede9fe'
        : isRecording
        ? '#fee2e2'
        : '#f3f4f6',
      color: isError
        ? '#b91c1c'
        : isDone
        ? '#065f46'
        : isProcessing
        ? '#5b21b6'
        : isRecording
        ? '#991b1b'
        : '#6b7280',
    } as React.CSSProperties,
    compatBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      fontSize: '11px',
      color: '#9ca3af',
      padding: '2px 8px',
      borderRadius: '999px',
      background: '#f9fafb',
      border: '1px solid #e5e7eb',
    },
  };

  // ─── Si no hay soporte en absoluto ──────────────────────────
  if (!isSupported) {
    return (
      <div style={{ ...styles.row, marginTop: '8px' }}>
        <span style={styles.compatBadge}>
          <Info size={12} />
          Dictado no disponible en este navegador (usa Chrome o Edge)
        </span>
      </div>
    );
  }

  const btnLabel = isRecording
    ? 'Detener dictado'
    : isProcessing
    ? 'Procesando...'
    : isDone
    ? '¡Listo!'
    : 'Dictar nota';

  const BtnIcon = isRecording
    ? MicOff
    : isProcessing
    ? Loader2
    : isDone
    ? CheckCircle2
    : Mic;

  return (
    <>
      {/* Keyframes inyectados una sola vez */}
      <style>{`
        @keyframes vd-pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(239,68,68,0.15); }
          50%       { box-shadow: 0 0 0 8px rgba(239,68,68,0.05); }
        }
        @keyframes vd-spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={styles.wrapper}>
        <div style={styles.row}>
          {/* Botón micrófono */}
          <button
            type="button"
            id="voice-dictation-btn"
            onClick={handleToggle}
            disabled={isProcessing}
            title={btnLabel}
            style={styles.micBtn}
          >
            <BtnIcon
              size={16}
              style={isProcessing ? { animation: 'vd-spin 1s linear infinite' } : undefined}
            />
            {btnLabel}
          </button>

          {/* Badge de estado */}
          {status !== 'idle' && (
            <span style={styles.statusBadge}>
              {isError && <AlertCircle size={11} />}
              {isDone && <CheckCircle2 size={11} />}
              {isRecording && '● Grabando'}
              {isProcessing && 'Mejorando con IA…'}
              {isDone && 'Transcripción lista'}
              {isError && (errorMessage || 'Error')}
            </span>
          )}

          {/* Indicador de compatibilidad (solo Web Speech) */}
          {!(window as any).SpeechRecognition && !(window as any).webkitSpeechRecognition && (
            <span style={styles.compatBadge}>
              <Info size={11} />
              Solo Whisper (sin tiempo real)
            </span>
          )}
        </div>

        {/* Transcripción en tiempo real */}
        {isRecording && interimText && (
          <div style={styles.interimBox}>
            {interimText}
            <span style={{ opacity: 0.4 }}> |</span>
          </div>
        )}

        {/* Mensaje de error amigable */}
        {isError && errorMessage && (
          <div style={{
            fontSize: '12px',
            color: '#b91c1c',
            background: '#fff1f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '6px 10px',
          }}>
            {errorMessage}
          </div>
        )}

        {/* Aviso si Whisper falló pero se usó fallback */}
        {isDone && errorMessage && (
          <div style={{
            fontSize: '12px',
            color: '#92400e',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            padding: '6px 10px',
          }}>
            ⚠️ {errorMessage}
          </div>
        )}
      </div>
    </>
  );
};

export default VoiceDictation;
