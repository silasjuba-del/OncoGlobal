import { createCaptureLifetime } from '../ai/captureLifetime';
import { useEffect, useRef, useState } from 'react';
import { transcribeBytes } from '../ai/transcription';

/** Grava do microfone e transcreve (API de transcrição da OpenAI, chave do GPT). */
export function MicButton({ onText, onError }: { onText(text: string): void; onError(msg: string): void }) {
  const [state, setState] = useState<'idle' | 'starting' | 'rec' | 'busy'>('idle');
  const [secs, setSecs] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const lifetime = useRef<ReturnType<typeof createCaptureLifetime> | null>(null);
  const starting = useRef(false);
  useEffect(() => {
    const resources = createCaptureLifetime(); lifetime.current = resources;
    return () => resources.dispose();
  }, []);

  useEffect(() => {
    if (state !== 'rec') return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [state]);

  const start = async () => {
    const resources = lifetime.current;
    if (!resources?.isActive() || starting.current) return;
    starting.current = true; setState('starting');
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!resources.replaceStream(stream)) return;
      const currentStream = stream;
      const mr = new MediaRecorder(currentStream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '' });
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = async () => {
        currentStream.getTracks().forEach((t) => t.stop());
        if (!resources.isActive()) return;
        setState('busy');
        try {
          const blob = new Blob(chunks.current, { type: 'audio/webm' });
          const bytes = new Uint8Array(await blob.arrayBuffer());
          if (!resources.isActive()) return;
          const text = await transcribeBytes(bytes, 'gravacao.webm');
          if (resources.isActive()) onText(text);
        } catch (e) {
          if (resources.isActive()) onError((e as Error).message);
        } finally {
          if (resources.isActive()) setState('idle');
        }
      };
      resources.setStopRecording(() => { if (mr.state !== 'inactive') mr.stop(); });
      mr.start(1000);
      rec.current = mr;
      setSecs(0);
      setState('rec');
    } catch (e) {
      stream?.getTracks().forEach(t => t.stop());
      if (resources.isActive()) { setState('idle'); onError(`Microfone indisponível: ${(e as Error).message}`); }
    } finally { starting.current = false; }
  };

  const label = state === 'rec' ? `Parar (${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')})` : state === 'busy' ? 'Transcrevendo…' : state === 'starting' ? 'Abrindo microfone…' : 'Ditado';
  return (
    <button
      type="button"
      className={`btn btn-sm mic ${state === 'rec' ? 'recording' : ''}`}
      disabled={state === 'busy' || state === 'starting'}
      onClick={() => (state === 'rec' ? rec.current?.stop() : start())}
      title="Gravar áudio e transcrever para o campo de texto"
      aria-pressed={state === 'rec'}
    >
      <span className="mic-dot" aria-hidden />
      {label}
    </button>
  );
}
