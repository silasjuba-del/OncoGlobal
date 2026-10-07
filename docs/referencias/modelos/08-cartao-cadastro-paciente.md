# Modelo 08 · Cartão de cadastro do paciente (sistema hospitalar real)

> Fonte: 3 capturas do cadastro institucional (Dr. Silas, 2026-10-06). **Nenhum dado de paciente salvo**; só os campos.

## Campos (ordem do sistema)
Nome (título) · Convênio (ex.: SUS BPA) · Prontuário (nº.sequência) · Matrícula · CNS · Data/Hora (do atendimento) · Nascimento · Idade ("NN anos e N meses") · Sexo · Profissão · Mãe · Responsável · Cidade (+UF) · Endereço · Obs.

## Observações para o app
- **Matrícula = CNS** nas três capturas (mesmo número): o app trata Matrícula como alias do CNS quando iguais; se diferentes, mostra os dois (identidade nunca pelo nome — Q13).
- Idade em "anos e meses" é calculada do nascimento (código), nunca digitada.
- "SEM INFORMACAO" em Responsável = campo ausente → PENDENTE, não texto.
- Mãe + nascimento + CNS = chave de conferência de identidade (homônimos).
- Profissão alimenta laudos previdenciários (Modelo 07) e BPC (Modelo 04).
- Cidade + endereço: só local; nunca em payload de LLM (G-02).
- Cabeçalho do app (Muse/Cursor) pode espelhar este cartão na barra lateral da consulta.
