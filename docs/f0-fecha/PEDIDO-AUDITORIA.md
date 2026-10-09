# Pedido de auditoria cruzada F0 — somente leitura

Autoridade: `docs/ondas/F0-FECHAMENTO-ASTRA.md`, fase D1, R-25 nível 3. Destinatário: Claude ou Antigravity, independente da Astra. Este pedido ainda não constitui auditoria executada.

## Base a fixar no início da execução

Repositório: `C:/Users/silas/Projects/OncoGlobal`. Ramo auditado: `f0/w1-integrado`. Compare `origin/main...f0/w1-integrado`. A Astra registrará o SHA exato de ambos os lados junto da saída. Não auditar outro projeto ou a pasta CANONICA. Não assumir que relatórios antigos provam o HEAD atual.

## Restrições

Somente leitura de código, contratos, testes e documentos técnicos necessários. Não editar, formatar, executar comandos de build/teste/instalação, conectar provider, ler `.env`/credenciais, abrir banco clínico real, imagem ou manual de referência. Nenhuma busca externa ou ferramenta de envio é necessária. As provas e fontes são locais; informações não verificadas ficam UNVERIFIED.

## Perguntas da revisão

1. Alguma rota ou proteção de W10/W11/W12 foi perdida na integração? Verifique o diff e as resoluções de A3, incluindo as provas adversariais originais preservadas.
2. A confirmação pode assinar versão/conteúdo diferente do que a interface mostrou? Examine bundle, recibo de exibição, sessão, paciente/encontro/lote, expectedRevision e chave de idempotência; teste declarado não substitui seguir o código.
3. Troca de contexto ou resposta atrasada pode mostrar/confirmar dados de outro paciente, encontro ou lote? Conferir `ConsultaPersistida`, revisão de extração e leituras do servidor.
4. Alguma ausência vira valor, conflito desaparece, vínculo é criado automaticamente ou fonte não revista é promovida? Compare reconciliação multifonte antes/depois da confirmação, rascunhos, fatos e documentos assinados.
5. Retry após resposta perdida duplica eventos/documentos ou permite reutilizar a mesma chave com conteúdo diferente?
6. Há saída de dado clínico para provider/rede não autorizada, segredo exposto, scanner com exceção ampla ou dispensa indevida de pendência? A LLM do produto deve continuar desligada.
7. A demo e a matriz distinguem núcleo F0 comprovado, composição HTTP real, demonstração sintética e escopo F1+? Relate alegações de implementação que não tenham consumidor/prova correspondente.

## Saída requerida

Primeiro liste achados ALTO/MÉDIO/BAIXO com arquivo e linha, cenário causal reproduzível, consequência e correção mínima recomendada. Distinga defeito confirmado de hipótese e lacuna de evidência. Não invente achados para preencher categorias. Termine com os limites da leitura e diga se há ALTO aberto; não autorize merge nem decida clínica.

Achado ALTO exige correção e reataque independente. Uma resposta do auditor sem SHA, evidência ou cobertura suficiente não fecha D1. A decisão de merge continua do Dr. Silas.
