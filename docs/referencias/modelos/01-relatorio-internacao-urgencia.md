# Modelo 01 · Relatório médico — solicitação de internação hospitalar em caráter de urgência

> Fonte: Dr. Silas, 2026-10-06 (DECISAO_MEDICA). Texto fixo mantido como escrito; o caso real que acompanhava o modelo foi **retirado** (datas, achados e história são quase-identificadores).
> `{{...}}` = caixa preenchida pelo app a partir do prontuário (proposta da IA, validada pelo médico). `[[...]]` = escolha do médico. Ausente = PENDENTE, nunca inventado.
> Exemplo de uso do modelo: compressão medular/cauda equina (urgência oncológica). Outras urgências trocam os blocos marcados como VARIÁVEL.

---

RELATÓRIO MÉDICO — SOLICITAÇÃO DE INTERNAÇÃO HOSPITALAR EM CARÁTER DE URGÊNCIA

Destino inicial: {{hospital_destino_inicial}}
Finalidade: {{finalidade_internacao}}, com programação de {{programacao_seguinte}} e transferência para {{hospital_transferencia}}, conforme regulação e avaliação da {{servico_avaliador}}.

DIAGNÓSTICO ONCOLÓGICO
Paciente em acompanhamento em Oncologia Clínica por {{diagnostico_histologico}} {{status_doenca}}, com {{sitios_doenca}}, {{biomarcadores}}.
Submetido(a) em {{data_cirurgia}} a {{procedimento_cirurgico}}, com estadiamento anatomopatológico {{estadiamento_patologico}} — estádio {{estadio}}.

HISTÓRIA ONCOLÓGICA CRONOLÓGICA
{{cronologia_oncologica}}   <!-- lista "MM/AAAA — exame/procedimento: achado", da linha do tempo validada -->
{{tratamento_sistemico_atual}}   <!-- esquema em uso/proposto, acesso venoso, analgesia e sintomáticos prescritos -->

QUADRO CLÍNICO ATUAL — URGÊNCIA ONCOLÓGICA   <!-- VARIÁVEL -->
Paciente evolui atualmente com {{quadro_clinico_atual}}, em contexto de {{contexto_doenca}}.
O conjunto {{achados_que_configuram}} configura quadro clínico ALTAMENTE SUSPEITO DE {{sindrome_suspeita}}, constituindo URGÊNCIA ONCOLÓGICA, com risco de {{riscos_progressao}}.

JUSTIFICATIVA PARA INTERNAÇÃO   <!-- VARIÁVEL: itens default para compressão medular -->
SOLICITO INTERNAÇÃO HOSPITALAR EM CARÁTER DE URGÊNCIA NO {{hospital_destino_inicial}}, para:
1. Controle intensivo da dor oncológica e ajuste de analgesia;
2. Avaliação neurológica seriada e documentação objetiva da força/sensibilidade dos membros inferiores e função esfincteriana;
3. RM de coluna com prioridade, visando definir nível e extensão da compressão neural;
4. Corticoterapia e demais medidas para síndrome compressiva conforme avaliação hospitalar;
5. Avaliação de estabilidade vertebral e necessidade de parecer neurocirúrgico/ortopédico, conforme achados;
6. Articulação imediata com Radioterapia.

Após estabilização inicial e definição radiológica, solicito REGULAÇÃO/TRANSFERÊNCIA PARA O {{hospital_transferencia}}, com previsão de {{tratamento_previsto}}, conforme planejamento do serviço de {{servico_avaliador}}.
Não considero adequado manejo exclusivamente ambulatorial neste momento, diante de {{motivo_nao_ambulatorial}}.

Diagnóstico principal: {{diagnostico_principal_com_tnm}}.
Complicação atual: {{complicacao_atual}}.
Finalidade da internação: {{finalidade_resumo}}.

{{medico_nome}}
{{medico_crm}}
{{medico_especialidade}}
