/** Caixa global que guarda as seleções explícitas padrão da Consulta Flash. */
export const CHAVE_CAIXA_MODELO_FLASH = "config.flash.modeloPadrao";
export const NUMERO_CAIXA_MODELO_FLASH = 17;
export const LABS_MODELO_FLASH = ["HMG", "U", "Cr", "TGO", "TGP"];
export const RAD_MODELO_FLASH = ["TC tórax", "TC abdome superior", "TC abdome inferior", "Cintilografia"];
export interface ModeloFlash { laboratorio: boolean; imagem: boolean; solicitacoes?: {laboratorio:string[];imagem:string[]} }
/** Booleanos legados são lidos mas nunca inventam quais exames estavam selecionados. */
export function lerModeloFlashConfigurado(valor: unknown): ModeloFlash | null {
 if(!valor || typeof valor!=="object" || Array.isArray(valor)) return null;
 const v=valor as Record<string,unknown>;
 if(Object.keys(v).some(k=>!["laboratorio","imagem","solicitacoes"].includes(k)) || typeof v.laboratorio!=="boolean" || typeof v.imagem!=="boolean") return null;
 if(!Object.hasOwn(v,"solicitacoes")) return {laboratorio:v.laboratorio,imagem:v.imagem};
 const s=v.solicitacoes;
 if(!s || typeof s!=="object" || Array.isArray(s)) return null;
 const o=s as Record<string,unknown>;
 if(Object.keys(o).length!==2 || !Array.isArray(o.laboratorio) || !Array.isArray(o.imagem)) return null;
 const lista=(x:unknown[]): x is string[] => x.length<=50 && x.every(t=>typeof t==="string" && t.trim().length>0 && t.length<=200);
 if(!lista(o.laboratorio) || !lista(o.imagem)) return null;
 return {laboratorio:v.laboratorio,imagem:v.imagem,solicitacoes:{laboratorio:[...new Set(o.laboratorio.map(t=>t.trim()))],imagem:[...new Set(o.imagem.map(t=>t.trim()))]}};
}
