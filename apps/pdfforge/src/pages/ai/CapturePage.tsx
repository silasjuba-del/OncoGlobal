import { createCaptureLifetime } from '../../ai/captureLifetime';
// Captura de tela: foto, vídeo (com áudio do sistema no Windows) e gravador de frames de 10–20 s para rolagem de
// TC/RM. Tudo fica local até o usuário enviar à IA; a análise de frames é rotulada como apoio, não laudo.
import { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import { useActions } from '../../app/actions';
import { imageAttachment, textAttachment } from '../../ai/attachments';
import { captureSources, openCaptureStream } from '../../ai/bridge';
import { transcribeBytes } from '../../ai/transcription';
import { imagesToPdf } from '../../engine/ops';
import { saveFile } from '../../platform/platform';

type Mode = 'photo' | 'video' | 'frames';
interface Source {
  id: string;
  name: string;
  thumb: string;
}
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Frame {
  url: string;
  bytes: Uint8Array;
  t: number;
  keep: boolean;
}

const toBytes = (canvas: HTMLCanvasElement, type: string, q?: number) =>
  new Promise<Uint8Array>((res, rej) => canvas.toBlob(async (b) => (b ? res(new Uint8Array(await b.arrayBuffer())) : rej(new Error('Falha na captura'))), type, q));

export function CapturePage() {
  const actions = useActions();
  const [sources, setSources] = useState<Source[] | null>(null);
  const [sourceId, setSourceId] = useState('');
  const [mode, setMode] = useState<Mode>('frames');
  const [withAudio, setWithAudio] = useState(true);
  const [seconds, setSeconds] = useState(15);
  const [fps, setFps] = useState(2);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [crop, setCrop] = useState<Rect | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [recording, setRecording] = useState<{ until: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [photo, setPhoto] = useState<{ url: string; bytes: Uint8Array } | null>(null);
  const [video, setVideo] = useState<{ url: string; bytes: Uint8Array } | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lifetime = useRef<ReturnType<typeof createCaptureLifetime> | null>(null);

  const loadSources = async () => {
    try {
      const list = await captureSources();
      setSources(list);
      if (!sourceId && list[0]) setSourceId(list[0].id);
    } catch (e) {
      actions.toast((e as Error).message, 'error');
    }
  };

  useEffect(() => {
    const recursos = createCaptureLifetime(); lifetime.current = recursos;
    void loadSources();
    return () => recursos.dispose();
    // Carrega as fontes uma vez; o fluxo é encerrado ao fechar a aba.
  }, []);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [recording]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  const connect = async () => {
    try {
      const recursos = lifetime.current;
      const s = await openCaptureStream(sourceId, mode === 'video' && withAudio);
      if (!recursos || !recursos.replaceStream(s)) { if (!recursos) s.getTracks().forEach(t => t.stop()); return; }
      setStream(s);
      setCrop(null);
    } catch (e) {
      actions.toast(`Captura recusada ou indisponível: ${(e as Error).message}`, 'error');
    }
  };

  /** Quadro atual do vídeo, recortado pela região escolhida (coordenadas relativas 0–1). */
  const grab = async (type = 'image/png', q?: number): Promise<{ url: string; bytes: Uint8Array }> => {
    const v = videoRef.current!;
    const r = crop ?? { x: 0, y: 0, w: 1, h: 1 };
    const sx = r.x * v.videoWidth;
    const sy = r.y * v.videoHeight;
    const sw = Math.max(1, r.w * v.videoWidth);
    const sh = Math.max(1, r.h * v.videoHeight);
    const c = document.createElement('canvas');
    c.width = Math.round(sw);
    c.height = Math.round(sh);
    c.getContext('2d')!.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return { url: c.toDataURL(type, q), bytes: await toBytes(c, type, q) };
  };

  const takePhoto = async () => setPhoto(await grab());

  const recordFrames = () => {
    const recursos = lifetime.current;
    const out: Frame[] = [];
    const start = Date.now();
    setFrames([]);
    setRecording({ until: start + seconds * 1000 });
    const iv = setInterval(async () => {
      const f = await grab('image/jpeg', 0.9);
      if (!recursos?.isActive()) return;
      out.push({ ...f, t: (Date.now() - start) / 1000, keep: true });
      setFrames([...out]);
    }, 1000 / fps);
    const stop = () => {
      clearInterval(iv);
      clearTimeout(to);
      if (recursos?.isActive()) setRecording(null);
    };
    const to = setTimeout(stop, seconds * 1000);
    recursos?.setStopRecording(stop);
  };

  const recordVideo = () => {
    const recursos = lifetime.current;
    const rec = new MediaRecorder(stream!, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm' });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (!recursos?.isActive()) return;
      setVideo({ url: URL.createObjectURL(blob), bytes });
      setRecording(null);
    };
    rec.start(1000);
    setRecording({ until: Date.now() + 10 * 60 * 1000 });
    recursos?.setStopRecording(() => { if (rec.state !== 'inactive') rec.stop(); });
  };

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      actions.toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const kept = frames.filter((f) => f.keep);

  // Seleção de região arrastando sobre a prévia.
  const rel = (e: React.MouseEvent) => {
    const b = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)) };
  };

  return (
    <div className="llm">
      <header className="llm-head">
        <span className="llm-badge" style={{ background: '#E8710A' }}>
          ◉
        </span>
        <div>
          <h1>Captura de tela</h1>
          <span className="muted small">Foto, vídeo e frames (10–20 s) — fica no computador até você enviar</span>
        </div>
        <div className="segmented llm-mode" role="radiogroup" aria-label="Modo de captura">
          {(
            [
              ['photo', 'Foto'],
              ['video', 'Vídeo'],
              ['frames', 'Frames TC/RM'],
            ] as const
          ).map(([m, l]) => (
            <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
              {l}
            </button>
          ))}
        </div>
      </header>
      <div className="chat-layout">
        <div className="chat-main capture-main">
          <div className="row">
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} aria-label="Tela ou janela">
              {(sources ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button className="btn btn-sm" onClick={loadSources}>
              Atualizar lista
            </button>
            {mode === 'video' && (
              <label className="check small">
                <input type="checkbox" checked={withAudio} onChange={(e) => setWithAudio(e.target.checked)} />
                <span>Áudio do sistema</span>
              </label>
            )}
            <button className="btn btn-sm btn-primary" disabled={!sourceId} onClick={connect}>
              {stream ? 'Trocar fonte' : 'Conectar'}
            </button>
            {crop && (
              <button className="btn btn-sm btn-ghost" onClick={() => setCrop(null)}>
                Limpar região
              </button>
            )}
          </div>
          {sources && sources.length > 0 && !stream && (
            <div className="source-grid">
              {sources.map((s) => (
                <button key={s.id} className={`source-thumb ${s.id === sourceId ? 'on' : ''}`} onClick={() => setSourceId(s.id)}>
                  <img src={s.thumb} alt="" />
                  <span>{s.name}</span>
                </button>
              ))}
            </div>
          )}
          {stream && (
            <div
              className="capture-preview"
              onMouseDown={(e) => !recording && setDrag(rel(e))}
              onMouseMove={(e) => {
                if (!drag) return;
                const p = rel(e);
                setCrop({ x: Math.min(drag.x, p.x), y: Math.min(drag.y, p.y), w: Math.abs(p.x - drag.x), h: Math.abs(p.y - drag.y) });
              }}
              onMouseUp={() => {
                setDrag(null);
                setCrop((c) => (c && c.w > 0.02 && c.h > 0.02 ? c : null));
              }}
            >
              <video ref={videoRef} autoPlay muted />
              {crop && <div className="crop-rect" style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }} />}
              {!crop && !recording && <span className="crop-hint">Arraste para escolher a região (ex.: só a imagem do exame)</span>}
            </div>
          )}
          {stream && (
            <div className="row">
              {mode === 'photo' && (
                <button className="btn btn-primary" onClick={() => run('Capturando…', takePhoto)}>
                  Tirar foto
                </button>
              )}
              {mode === 'frames' && (
                <>
                  <label className="small">
                    Duração{' '}
                    <input type="number" min={10} max={20} value={seconds} onChange={(e) => setSeconds(Math.min(20, Math.max(10, Number(e.target.value))))} style={{ width: 64 }} /> s
                  </label>
                  <label className="small">
                    Quadros/s{' '}
                    <select value={fps} onChange={(e) => setFps(Number(e.target.value))}>
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                  </label>
                  {!recording ? (
                    <button className="btn btn-primary" onClick={recordFrames}>
                      Gravar frames ({seconds * fps})
                    </button>
                  ) : (
                    <button className="btn" onClick={() => lifetime.current?.stop()}>
                      Parar ({Math.max(0, Math.ceil((recording.until - now) / 1000))} s)
                    </button>
                  )}
                  <span className="muted small">Role o exame no visualizador durante a gravação.</span>
                </>
              )}
              {mode === 'video' &&
                (!recording ? (
                  <button className="btn btn-primary" onClick={recordVideo}>
                    Gravar vídeo
                  </button>
                ) : (
                  <button className="btn" onClick={() => lifetime.current?.stop()}>
                    Parar gravação
                  </button>
                ))}
            </div>
          )}
          {busy && <p className="muted small">{busy}</p>}

          {mode === 'photo' && photo && (
            <div className="capture-result">
              <img src={photo.url} alt="Captura" className="capture-img" />
              <div className="row">
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => run('Preparando…', async () => actions.openLlm('claude', { attachments: [await imageAttachment('captura.png', photo.bytes, 'image/png')], promptId: 'foto-prompt' }))}
                >
                  Foto → Prompt (IA)
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => run('Preparando…', async () => actions.openLlm('claude', { attachments: [await imageAttachment('captura.png', photo.bytes, 'image/png')], promptId: 'foto-ui' }))}
                >
                  Foto → UI/UX
                </button>
                <button className="btn btn-sm" onClick={() => saveFile('captura.png', photo.bytes)}>
                  Salvar PNG
                </button>
              </div>
            </div>
          )}

          {mode === 'video' && video && (
            <div className="capture-result">
              <video src={video.url} controls className="capture-img" />
              <div className="row">
                <button className="btn btn-sm" onClick={() => saveFile('gravacao-tela.webm', video.bytes)}>
                  Salvar vídeo
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  disabled={video.bytes.length > 25 * 1024 * 1024}
                  title={video.bytes.length > 25 * 1024 * 1024 ? 'Acima de 25 MB: a API de transcrição recusa' : ''}
                  onClick={() =>
                    run('Transcrevendo áudio…', async () => {
                      const text = await transcribeBytes(video.bytes, 'gravacao-tela.webm');
                      actions.openLlm('claude', { attachments: [textAttachment('Transcrição da gravação de tela', text)], promptId: 'transcricao-notas' });
                    })
                  }
                >
                  Transcrever áudio → IA
                </button>
                <span className="muted small">{(video.bytes.length / 1024 / 1024).toFixed(1)} MB</span>
              </div>
            </div>
          )}

          {mode === 'frames' && frames.length > 0 && (
            <div className="capture-result">
              <div className="row space">
                <strong>
                  {kept.length}/{frames.length} quadros selecionados
                </strong>
                <div className="row">
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={!kept.length || !!recording}
                    onClick={() =>
                      run('Preparando quadros…', async () => {
                        const sample = kept.length > 20 ? kept.filter((_, i) => i % Math.ceil(kept.length / 20) === 0) : kept;
                        const atts = await Promise.all(sample.map((f, i) => imageAttachment(`quadro-${i + 1}-${f.t.toFixed(1)}s.jpg`, f.bytes, 'image/jpeg')));
                        actions.openLlm('claude', { attachments: atts, promptId: 'frames-exame' });
                      })
                    }
                  >
                    Analisar com IA (apoio)
                  </button>
                  <button
                    className="btn btn-sm"
                    disabled={!kept.length || !!recording}
                    onClick={() =>
                      run('Montando PDF…', async () => {
                        const [pdf] = await imagesToPdf(
                          kept.map((f, i) => ({ name: `quadros-exame-${i + 1}.jpg`, bytes: f.bytes, type: 'jpg' as const })),
                          { pageSize: 'fit', orientation: 'auto', margin: 0, merge: true },
                        );
                        actions.openViewer({ name: 'quadros-exame.pdf', bytes: pdf.bytes, path: null });
                      })
                    }
                  >
                    Quadros → PDF
                  </button>
                  <button
                    className="btn btn-sm"
                    disabled={!kept.length || !!recording}
                    onClick={() =>
                      run('Compactando…', async () => {
                        const zip = new JSZip();
                        kept.forEach((f, i) => zip.file(`quadro-${String(i + 1).padStart(3, '0')}.jpg`, f.bytes));
                        await saveFile('quadros-exame.zip', await zip.generateAsync({ type: 'uint8array' }));
                      })
                    }
                  >
                    Salvar ZIP
                  </button>
                </div>
              </div>
              <p className="muted small">Clique em um quadro para incluir/excluir. A análise por IA é apoio para estudo e revisão — não substitui o laudo.</p>
              <div className="frame-grid">
                {frames.map((f, i) => (
                  <button key={i} className={`frame ${f.keep ? 'on' : ''}`} onClick={() => setFrames((fs) => fs.map((x, j) => (j === i ? { ...x, keep: !x.keep } : x)))}>
                    <img src={f.url} alt={`Quadro ${i + 1}`} />
                    <span>
                      {i + 1} · {f.t.toFixed(1)}s
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
