import { configure } from "@testing-library/react";

/**
 * Jornadas de app completo (OncoassistLocal) sobre servidor HTTP real.
 * Medição EST-01 (2026-10-24): o servidor responde cada rota em até 116 ms, mas o render jsdom da tela
 * completa somado à cadeia de recargas leva até ~1,8 s até o elemento aparecer; o findBy padrão de 1 s não
 * cobre. Orçamento medido (~2,7× o observado), restrito aos arquivos que chamam esta função; nenhuma
 * asserção muda. Cada arquivo roda isolado (vitest forks), então a configuração não vaza.
 */
export function usarEsperaDeJornadaHttpCompleta(): void {
  configure({ asyncUtilTimeout: 5_000 });
}
