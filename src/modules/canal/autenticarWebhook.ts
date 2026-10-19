// Ingresso F2, transporte webhook. O HMAC-SHA256 cobre os bytes crus, no formato
// sha256=<hex> do cabeçalho X-Hub-Signature-256. Segredo e keyId vêm do servidor.
// Este passo não persiste e não emite ACK.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Instante } from "../../contracts/base.js";

export const LIMITE_BYTES_CORPO_WEBHOOK = 262_144;
export const LIMITE_BYTES_SEGREDO = 512;
export const LIMITE_KEY_ID = 250;
export const LIMITE_PROFUNDIDADE_JSON = 16;
export const LIMITE_NOS_JSON = 256;

const PREFIXO_HMAC = "sha256=";
const CHAVES_ALEGADAS = new Set([
  "accountid", "account_id", "contaid",
  "patientid", "pacienteid", "patient_id",
  "autenticacao", "autenticada", "authenticated",
  "aprovado", "aprovacao", "approved",
  "redflag", "red_flag",
  "classificacao", "classificacaoclinica", "classification",
  "diagnostico", "conduta", "estadoclinico",
]);

export type RecusaWebhook =
  | { ok: false; codigo: "TAMANHO_EXCEDIDO"; limiteBytes: number; bytesRecebidos: number }
  | { ok: false; codigo: "SEGREDO_AUSENTE" }
  | { ok: false; codigo: "CONFIGURACAO_INVALIDA" }
  | { ok: false; codigo: "ASSINATURA_AUSENTE" }
  | { ok: false; codigo: "ASSINATURA_INVALIDA" }
  | { ok: false; codigo: "PAYLOAD_MALFORMADO" }
  | { ok: false; codigo: "ALEGACAO_REMETENTE"; campo: string };

export type ProvaWebhook = {
  metodo: "WEBHOOK_HMAC_SHA256";
  verificada: true;
  keyId: string;
  payloadSha256: string;
  verificadoEm: string;
};

/** Prova do transporte. persistida é falso: o ACK ainda não existe. */
export type WebhookAutenticado = {
  ok: true;
  persistida: false;
  prova: ProvaWebhook;
  bytes: Uint8Array;
};

export type ResultadoWebhook = RecusaWebhook | WebhookAutenticado;

export type PedidoWebhook = {
  bytes: Uint8Array;
  assinatura: string | null;
  segredo: string | Uint8Array;
  keyId: string;
  verificadoEm: string;
};

export function autenticarWebhookHmac(pedido: PedidoWebhook): ResultadoWebhook {
  const bytesRecebidos = pedido.bytes.byteLength;
  if (bytesRecebidos > LIMITE_BYTES_CORPO_WEBHOOK) {
    return { ok: false, codigo: "TAMANHO_EXCEDIDO", limiteBytes: LIMITE_BYTES_CORPO_WEBHOOK, bytesRecebidos };
  }
  if (!segredoPresente(pedido.segredo)) return { ok: false, codigo: "SEGREDO_AUSENTE" };
  if (tamanhoSegredo(pedido.segredo) > LIMITE_BYTES_SEGREDO) return { ok: false, codigo: "CONFIGURACAO_INVALIDA" };
  if (!keyIdValido(pedido.keyId) || !Instante.safeParse(pedido.verificadoEm).success) {
    return { ok: false, codigo: "CONFIGURACAO_INVALIDA" };
  }
  if (pedido.assinatura === null || pedido.assinatura.trim().length === 0) {
    return { ok: false, codigo: "ASSINATURA_AUSENTE" };
  }
  const recebido = digestAssinatura(pedido.assinatura);
  const calculado = createHmac("sha256", pedido.segredo).update(pedido.bytes).digest();
  if (recebido === null || recebido.length !== calculado.length || !timingSafeEqual(calculado, recebido)) {
    return { ok: false, codigo: "ASSINATURA_INVALIDA" };
  }

  let texto: string;
  try {
    texto = new TextDecoder("utf-8", { fatal: true }).decode(pedido.bytes);
  } catch {
    return { ok: false, codigo: "PAYLOAD_MALFORMADO" };
  }
  if (texto.trim().length === 0 || /"__proto__"\s*:/.test(texto) || profundidadeExcedida(texto)) {
    return { ok: false, codigo: "PAYLOAD_MALFORMADO" };
  }
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    return { ok: false, codigo: "PAYLOAD_MALFORMADO" };
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return { ok: false, codigo: "PAYLOAD_MALFORMADO" };
  }
  const varredura = varrer(json);
  if (varredura === "limite") return { ok: false, codigo: "PAYLOAD_MALFORMADO" };
  if (varredura !== "ok") return { ok: false, codigo: "ALEGACAO_REMETENTE", campo: varredura };

  return {
    ok: true,
    persistida: false,
    prova: {
      metodo: "WEBHOOK_HMAC_SHA256",
      verificada: true,
      keyId: pedido.keyId,
      payloadSha256: createHash("sha256").update(pedido.bytes).digest("hex"),
      verificadoEm: pedido.verificadoEm,
    },
    bytes: pedido.bytes.slice(),
  };
}

function segredoPresente(segredo: string | Uint8Array): boolean {
  return typeof segredo === "string" ? segredo.length > 0 : segredo.byteLength > 0;
}

function tamanhoSegredo(segredo: string | Uint8Array): number {
  return typeof segredo === "string" ? Buffer.byteLength(segredo) : segredo.byteLength;
}

function keyIdValido(keyId: string): boolean {
  return keyId.length > 0 && keyId.length <= LIMITE_KEY_ID && keyId === keyId.trim()
    && !/[\u0000-\u001f]/.test(keyId);
}

function digestAssinatura(assinatura: string): Buffer | null {
  const texto = assinatura.trim();
  if (!texto.startsWith(PREFIXO_HMAC)) return null;
  const hex = texto.slice(PREFIXO_HMAC.length);
  if (!/^[0-9a-f]{64}$/i.test(hex)) return null;
  return Buffer.from(hex, "hex");
}

function profundidadeExcedida(texto: string): boolean {
  let profundidade = 0;
  let emTexto = false;
  let escape = false;
  for (const char of texto) {
    if (emTexto) {
      if (escape) { escape = false; continue; }
      if (char === "\\") { escape = true; continue; }
      if (char === "\"") emTexto = false;
      continue;
    }
    if (char === "\"") { emTexto = true; continue; }
    if (char === "{" || char === "[") {
      profundidade += 1;
      if (profundidade > LIMITE_PROFUNDIDADE_JSON) return true;
    } else if (char === "}" || char === "]") {
      if (profundidade === 0) return true;
      profundidade -= 1;
    }
  }
  return false;
}

function varrer(raiz: unknown): "ok" | "limite" | string {
  const pilha: { valor: unknown; profundidade: number }[] = [{ valor: raiz, profundidade: 1 }];
  let nos = 0;
  while (pilha.length > 0) {
    const item = pilha.pop();
    if (!item) break;
    nos += 1;
    if (nos > LIMITE_NOS_JSON || item.profundidade > LIMITE_PROFUNDIDADE_JSON) return "limite";
    const valor = item.valor;
    if (!valor || typeof valor !== "object") continue;
    if (Array.isArray(valor)) {
      for (const filho of valor) pilha.push({ valor: filho, profundidade: item.profundidade + 1 });
      continue;
    }
    const registro = valor as Record<string, unknown>;
    for (const chave of Object.keys(registro)) {
      const normalizada = chave.toLowerCase();
      if (normalizada === "constructor" || normalizada === "prototype") return "limite";
      if (CHAVES_ALEGADAS.has(normalizada)) return chave;
      pilha.push({ valor: registro[chave], profundidade: item.profundidade + 1 });
    }
  }
  return "ok";
}
