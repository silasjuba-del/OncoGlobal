import { useEffect, useRef, useState } from 'react';
import { transcribeBytes } from '../ai/transcription';

/** Grava do microfone e transcreve (API de transcrição da OpenAI, chave do GPT). */
export function MicButton({ onText, onError }: { onText(text: string): void; onError(msg: string): void }) {
  const [state, setState] = useState<'idle' | 'rec' | 'busy'>('idle');
  const [secs, setSecs] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => {
    if (state !== 'rec') return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [state]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '' });
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState('busy');
        try {
          const blob = new Blob(chunks.current, { type: 'audio/webm' });
          onText(await transcribeBytes(new Uint8Array(await blob.arrayBuffer()), 'gravacao.webm'));
        } catch (e) {
          onError((e as Error).message);
        } finally {
          setState('idle');
        }
      };
      mr.start(1000);
      rec.current = mr;
      setSecs(0);
      setState('rec');
    } catch (e) {
      onError(`Microfone indisponível: ${(e as Error).message}`);
    }
  };

  const label = state === 'rec' ? `Parar (${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')})` : state === 'busy' ? 'Transcrevendo…' : 'Ditado';
  return (
    <button
      type="button"
      className={`btn btn-sm mic ${state === 'rec' ? 'recording' : ''}`}
      disabled={state === 'busy'}
      onClick={() => (state === 'rec' ? rec.current?.stop() : start())}
      title="Gravar áudio e transcrever para o campo de texto"
      aria-pressed={state === 'rec'}
    >
      <span className="mic-dot" aria-hidden />
      {label}
    </button>
  );
}
