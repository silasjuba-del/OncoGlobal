/** Decisão do Dr. Silas, 2026-10-19: dose pendente permanece em rascunho. Sem limiares clínicos. */
export function doseReceitaPendente(valor:unknown):boolean {
 if(typeof valor!=='string'||!valor.trim())return true;
 const texto=valor.normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f\u200B-\u200D\uFEFF]/g,'').replace(/[_\s-]+/g,' ').trim().toUpperCase();
 return /\b(PENDENTE|VERIFICAR|NAO INFORMAD[AO]|SEM FONTE|A DEFINIR|A CONFERIR)\b/.test(texto);
}

/** Fonte estruturada para novos documentos; campo Dose literal para os legados, sem reescrever história. */
export function documentoReceitaDosePendente(valor:unknown):boolean {
 if(!valor||typeof valor!=='object'||Array.isArray(valor))return false;
 const d=valor as Record<string,unknown>;
 if(!['RECEITA','FLASH_RECEITA','FLASH_CONJUNTO_IMPRESSAO'].includes(String(d.tipoDocumento)))return false;
 if(d.receitasSelecionadas!==undefined&&!Array.isArray(d.receitasSelecionadas))return true;
 if(Array.isArray(d.receitasSelecionadas)&&d.receitasSelecionadas.some(r=>!r||typeof r!=='object'||doseReceitaPendente((r as Record<string,unknown>).dose)))return true;
 if(Array.isArray(d.camposPendentes)&&d.camposPendentes.some(c=>typeof c==='string'&&/(^|\.)dose$/.test(c)))return true;
 const texto=typeof d.texto==='string'?d.texto:'';
 const doses=[...texto.matchAll(/^[ \t]*Dose[ \t]*:[ \t]*([^\r\n]*)/gim)];
 return doses.some(m=>doseReceitaPendente(m[1]))
  ||d.tipoDocumento==='FLASH_RECEITA'&&!doses.length;
}
