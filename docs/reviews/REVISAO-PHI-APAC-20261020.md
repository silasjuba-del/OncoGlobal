# Classificação da ocorrência sintética na prova APAC — 20/10/2026

O teste `tests/f4/pr27-apac-negativa-projecao.test.ts` usa um CNS fictício, criado durante a implementação da regressão AG-10. A sequência foi escolhida pela equipe Codex/Luna para repetir o mesmo valor entre pessoas e lotes sintéticos e demonstrar o isolamento da comparação. Não foi extraída de paciente, documento clínico ou fonte externa. A fixture opera em SQLite e não envia esse identificador a qualquer destinatário.

O literal permanece visível e com o mesmo valor que a fixture já produzia. Esta revisão substitui sua construção em runtime por uma disposição explícita `synthetic_declared`, restrita ao caminho, SHA-256 no modo `utf8-lf`, tipo, linha e ordinal encontrados pelo scanner. A ocorrência continua detectável; é classificada por evidência, sem alterar regex, teste, limiar ou diretório permitido.

Foi conferido que o único candidato desse arquivo é o CNS da fixture. Uma comparação com hash diferente deve voltar a produzir finding e pendência. Nenhuma disposição de outro arquivo foi alterada nesta etapa. Isto documenta autoria e revisão técnica de dados inventados para teste, não aprovação clínica nem declaração sobre anonimato de dados reais.
