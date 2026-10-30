// Mídia externa: legendas públicas do YouTube e metadados públicos de Reels do Instagram.
// Não baixa vídeos; conteúdo restrito a login fica de fora (ver docs/LOTE-2-IA.md).
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

function youtubeId(url) {
  const s = String(url).trim();
  const m =
    s.match(/[?&]v=([\w-]{11})/) ||
    s.match(/youtu\.be\/([\w-]{11})/) ||
    s.match(/youtube\.com\/(?:shorts|embed|live)\/([\w-]{11})/) ||
    s.match(/^([\w-]{11})$/);
  return m ? m[1] : null;
}

function extractJson(html, marker) {
  const start = html.indexOf(marker);
  if (start < 0) return null;
  let i = html.indexOf('{', start);
  let depth = 0;
  let inStr = false;
  for (let j = i; j < html.length; j++) {
    const c = html[j];
    if (inStr) {
      if (c === '\\') j++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON.parse(html.slice(i, j + 1));
  }
  return null;
}

const fmt = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// Clientes do InnerTube cujas URLs de legenda não exigem token de prova (o cliente WEB exige desde 2025).
const PLAYER_CLIENTS = [
  { context: { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 30 }, ua: 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip' },
  { context: { clientName: 'IOS', clientVersion: '20.10.4', deviceModel: 'iPhone16,2' }, ua: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3 like Mac OS X;)' },
];

async function fetchPlayer(id) {
  for (const c of PLAYER_CLIENTS) {
    try {
      const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': c.ua },
        body: JSON.stringify({ context: { client: { ...c.context, hl: 'pt' } }, videoId: id }),
      });
      const player = await res.json();
      if (player.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length) return { player, ua: c.ua };
      if (player.playabilityStatus?.status === 'OK') return { player, ua: c.ua };
    } catch {
      /* tenta o próximo cliente */
    }
  }
  // Último recurso: página web (pode não ter legendas acessíveis).
  const res = await fetch(`https://www.youtube.com/watch?v=${id}&hl=pt-BR`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8', Cookie: 'CONSENT=YES+1' },
  });
  if (!res.ok) throw new Error(`YouTube respondeu ${res.status}.`);
  return { player: extractJson(await res.text(), 'ytInitialPlayerResponse'), ua: UA };
}

async function youtubeTranscript(url) {
  const id = youtubeId(url);
  if (!id) throw new Error('URL do YouTube inválida.');
  const { player, ua } = await fetchPlayer(id);
  if (!player) throw new Error('Não consegui ler os dados do vídeo.');
  if (player.playabilityStatus?.status && player.playabilityStatus.status !== 'OK' && !player.captions) {
    throw new Error(`Vídeo indisponível: ${player.playabilityStatus.reason ?? player.playabilityStatus.status}.`);
  }
  const title = player.videoDetails?.title ?? id;
  const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  if (!tracks.length) throw new Error(`"${title}" não tem legendas públicas. Cole a transcrição manualmente.`);
  const pick =
    tracks.find((t) => t.languageCode?.startsWith('pt') && t.kind !== 'asr') ||
    tracks.find((t) => t.languageCode?.startsWith('pt')) ||
    tracks.find((t) => t.languageCode?.startsWith('en') && t.kind !== 'asr') ||
    tracks.find((t) => t.languageCode?.startsWith('en')) ||
    tracks[0];
  const capRes = await fetch(`${pick.baseUrl.replace(/&fmt=[^&]*/, '')}&fmt=json3`, { headers: { 'User-Agent': ua } });
  const raw = capRes.ok ? await capRes.text() : '';
  let lines = [];
  if (raw.trim()) {
    const data = JSON.parse(raw);
    lines = (data.events ?? [])
      .filter((e) => e.segs)
      .map((e) => `[${fmt(e.tStartMs ?? 0)}] ${e.segs.map((s) => s.utf8).join('').replace(/\s+/g, ' ').trim()}`)
      .filter((l) => !/\]\s*$/.test(l));
  }
  if (!lines.length) {
    throw new Error(
      `O YouTube não liberou a legenda de "${title}" para acesso automático. Abra o vídeo, use "Mostrar transcrição" e cole o texto.`,
    );
  }
  return {
    id,
    title,
    language: pick.languageCode,
    automatic: pick.kind === 'asr',
    url: `https://www.youtube.com/watch?v=${id}`,
    text: lines.join('\n'),
  };
}

/** Metadados públicos (og:*) de um Reel; o Instagram costuma exigir login, então pode voltar vazio. */
async function reelsMeta(url) {
  if (!/^https:\/\/(www\.)?instagram\.com\/(reel|reels|p)\//.test(String(url))) throw new Error('URL de Reel inválida.');
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9' } });
    const html = res.ok ? await res.text() : '';
    const meta = (p) =>
      html.match(new RegExp(`<meta[^>]+property=["']og:${p}["'][^>]+content=["']([^"']*)`, 'i'))?.[1]?.replace(/&quot;/g, '"').replace(/&amp;/g, '&') ?? null;
    return { url, title: meta('title'), description: meta('description'), loginWall: !meta('description') };
  } catch {
    return { url, title: null, description: null, loginWall: true };
  }
}

module.exports = { youtubeTranscript, youtubeId, reelsMeta, extractJson };
