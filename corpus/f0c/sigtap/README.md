# SIGTAP administrativo — competência 2026-09

Estado: **FONTE_OFICIAL_CONFERIDA**. Cadastro administrativo; não é declaração de elegibilidade clínica nem de autorização de APAC.

## Fonte e reprodução

Download direto realizado em 10/10/2026:

- [ZIP oficial DATASUS](ftp://ftp2.datasus.gov.br/pub/sistemas/tup/downloads/TabelaUnificada_202609_v2610050950.zip)
- SHA-256: `e2f1a210d8de4148f946e74f18b7726d4bc8145c97f48c2338874851789a03df`.
- [Documentação oficial de downloads](https://wiki.datasus.gov.br/sigtap/index.php/Download).
- [Atributos oficiais](https://wiki.datasus.gov.br/sigtap/index.php/Gerais).
- Decodificação Windows-1252. Esse detalhe preserva o travessão presente no arquivo; Latin-1 estrito produziria nove diferenças de descrição por caracteres de controle.
- Layouts de largura fixa lidos do próprio ZIP, sem posições inventadas. Arquivos utilizados: tb_procedimento, rl_procedimento_cid, rl_procedimento_registro, tb_financiamento, com respectivos layouts.

`scripts/sigtap-zip.mjs` lê diretamente o ZIP oficial em memória, pelo diretório central. Somente os oito arquivos necessários são descompactados e decodificados; nenhum caminho do ZIP é extraído para o filesystem. Há verificação do SHA-256 pinado, CRC32 por entrada e limites de tamanho descompactado. O JSON derivado redundante de 3.939.921 bytes foi removido após reprodução idêntica. Para reproduzir a saída, executar `node corpus/f0c/sigtap/gerar-cadastro.mjs <caminho-do-M-AN.md>`. O script não baixa rede, não ativa tabela e não produz decisões clínicas.

## Confronto e autorização

O pacote F0-FECHAMENTO-PACOTE-AUDITORIA, §3B C13, pede 154 códigos por competência. Sua implementação foi autorizada pelo Dr. Silas no pedido de seguir até o fechamento da F0 em 10/10/2026. Isso autoriza integração do cadastro oficial; não é recibo de curadoria clínica.

O M-AN-SIGTAP-03.04-ampliado-09-2026.md contém **149**, não 154, linhas. Todas as 149 descrições, códigos e valores SA coincidiram com a fonte oficial. As notas de anomalias `[sic]` permanecem no campo separado `observacoesFonte`, atribuído ao M-AN; a descrição oficial não foi corrigida.

O recorte oficial 03.04.02 a 03.04.08 contém **154** linhas. As cinco adicionais são 0304080020, 0304080039, 0304080047, 0304080063 e 0304080071. Preservar `instrumentosRegistro`: um cadastro existente não implica APAC principal. O helper `buscarProcedimentoApac` exige 06 para principal e 07 para secundário. AIH permanece no cadastro e não passa por esse helper.

## Limites explícitos

- Financiamento MAC/FAEC vem do código e da tabela oficiais, sem valor presumido.
- Valores SA são inteiros em centavos, sem arredondamento de ponto flutuante no importador oficial.
- CIDs principais usam apenas ST_PRINCIPAL=S. Relações condicionadas e habilitações não estão implementadas por este cadastro.
- Idades brutas estão preservadas. O layout não declara a unidade de armazenamento e a documentação descreve idade exibida em anos/dias/meses. Até comprovar a transformação, `idadeMinMeses` e `idadeMaxMeses` ficam null; anti-glosa deve indicar pendência.
- Finalidade clínica não é preenchida pelo importador: `finalidadeDoGrupo=null`.
- Loader exige competência, formato, hashes dos bytes do ZIP e conteúdo, fonte DATASUS, decisão documental e contagem válidos. Competência ausente não usa outra tabela como fallback.
- Testes de carregamento foram escritos; execução pertence à validação serial da integração.

## Prova de reprodução sem JSON intermediário

- Resultado: 154 procedimentos; confronto das mesmas 149 linhas.
- Hash do conteúdo: `8ef522e129455c030300c83fab5dc3f0e930f847e823eebe72c4760bf8143aa1`, idêntico ao pin previamente conferido.
- SHA-256 do arquivo canônico completo antes e depois: `d01cf0b1d03334a8b0d6231d60436b84dc221ec87c5de700114f6c056dd61fed`.
- O gerador rejeita contagem ou hash diferente antes de gravar. Não atualiza pins automaticamente. ZIP oficial e JSON canônico preservados.
