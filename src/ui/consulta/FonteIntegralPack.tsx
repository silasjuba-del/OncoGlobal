import { useEffect, useRef, useState } from 'react';
import type { LoteCompleto } from '../../contracts/fase2/loteCompleto.js';
import { FontePackResposta, type LotePackLeitura } from '../../contracts/fase2/leituraPack.js';

export function FonteIntegralPack({ lote, carregar }: {
  lote: LoteCompleto | LotePackLeitura;
  carregar?: ((signal: AbortSignal) => Promise<FontePackResposta>) | undefined;
}) {
  const [aberto, setAberto] = useState(false);
  const [fonte, setFonte] = useState<FontePackResposta | null>(null);
  const [erro, setErro] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const loader = useRef(carregar); loader.current = carregar;
  const integral = 'conteudoIntegral' in lote;
  const atual = fonte?.packId === lote.packId && fonte.original.sha256 === lote.original.sha256
    && fonte.original.arquivo === lote.original.arquivo ? fonte : null;
  useEffect(() => {
    if (!aberto || integral || atual) return;
    const abort = new AbortController(); let vigente = true;
    setErro('');
    const ler = loader.current;
    if (!ler) { setErro('Fonte integral indisponível nesta conexão.'); return; }
    void ler(abort.signal).then(bruto => {
      if (!vigente) return;
      const r = FontePackResposta.safeParse(bruto);
      if (!r.success || r.data.packId !== lote.packId || r.data.original.sha256 !== lote.original.sha256
        || r.data.original.arquivo !== lote.original.arquivo) throw Error('FONTE_DIVERGENTE');
      setFonte(r.data);
    }).catch(() => { if (vigente) setErro('Não foi possível conferir a fonte desta versão. O conteúdo do pack continua disponível.'); });
    return () => { vigente = false; abort.abort(); };
  }, [aberto, integral, atual, lote.packId, lote.original.sha256, lote.original.arquivo, tentativa]);
  return <details onToggle={e => setAberto(e.currentTarget.open)}>
    <summary>Fonte integral, versão e preservação</summary>
    <p>{lote.original.arquivo} · versão {lote.original.versao}</p><p>SHA-256: {lote.original.sha256}</p>
    {aberto && (integral || atual) ? <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
      {JSON.stringify(integral ? lote.conteudoIntegral : atual!.conteudoIntegral, null, 2)}
    </pre> : aberto ? erro ? <p role="status">{erro} <button type="button" onClick={() => setTentativa(t => t + 1)}>Tentar novamente</button></p>
      : <p role="status">Carregando fonte integral…</p> : null}
  </details>;
}
