# Cenários sintéticos da auditoria de jornadas (declarados antes da execução)

Todos os dados são SINTÉTICOS. Profissional e senha vêm da fixture `tests/f1/s12/fixtures/servidor-demo-b2.ts`.
Data de referência: o relógio fixo da fixture (`manifesto.agora`).

| Paciente | Documento importado (PDFForge, texto do PDF) | Esperado (derivado das regras/decisões vigentes, não da execução) |
|---|---|---|
| A — `Paciente SINTETICO A PULMAO` | TC de tórax 2026-10-09: massa em lobo superior direito 4,2 cm; **nega hemoptise**; linfonodo mediastinal suspeito **A CONFERIR**; anatomopatológico: adenocarcinoma de pulmão; **EGFR PENDENTE** | Jornada por skills sem urgência; cartão de pulmão consultável sem dose e sem autorizar tratamento; rascunhos de evolução, pedido de exames e encaminhamento; nenhum fato clínico criado pela skill; cada rascunho percorre Flash → assinatura explícita → reabertura após reinício. Retorno e follow-up não abrem etapa de QT (S08) sem pedido de discussão. |
| B — `Paciente SINTETICO B ISOLAMENTO` | TC de tórax semelhante; RM coluna: **sem sinais de massa epidural ou apagamento do saco dural** (negação) | Fontes de B nunca aparecem no encontro de A; resposta tardia de A não aparece no encontro de B; negação não gera alerta urgente. |
| C — `Paciente SINTETICO C EMERGENCIA` | RM coluna total 2026-10-10: **massa epidural em T10 com apagamento do saco dural**; biomarcador PENDENTE | Regra `rads-emergencias.v1.json` linha 1 (Compressão medular metastática: obrigatório `massa` + ≥2 elos; D-W9-51) ⇒ jornada `URGENTE`, alerta visível com fonte, propostas eletivas (cartões/ações) interrompidas, sem envio, prescrição ou administração automática. |
| D — `Paciente SINTETICO D IMUNOTERAPIA` | TC tórax em imunoterapia: **vidro fosco bilateral com padrão OP**; TC abdome: **espessamento mucoso contínuo do cólon com sinal do alvo** | Regras linha 28 (Pneumonite imunomediada/actínica) e linha 29 (Colite imunomediada) ⇒ `URGENTE` com os dois alertas. |

Regras numéricas em mg (D-F1-52, `docs/DECISOES.md`): 7,2 → 7; 7,5 → 7,5; 5,8 → 6; 0,3 → 0,3; 0,7 → 1; dose calculada positiva nunca vira zero como PRONTO.

Decisão explícita de Silas em 31/10/2026: µg conserva o cálculo sem arredondamento. Exemplos: 0,005 µg/kg × 70 kg = 0,35 µg; 5,5 × 71 = 390,5 µg. O identificador histórico `DOSE.D-F1-52_ug_positiva_pequena_nao_zera` foi preservado para rastrear a regressão, sem estender a regra de arredondamento em mg aos microgramas.

Extensões da auditoria:

- Pedido assinado no primeiro encontro de A → importação documental no retorno de A → REALIZADO → RESULTADO_DISPONIVEL → REVISADO → reinício → recuperação do mesmo vínculo, sourceId e hash. Fonte de B ou do encontro anterior é recusada para essa nova vinculação. Reenvio da mesma operação não duplica o vínculo.
- Relatório pericial pela navegação operacional → edição médica → prévia sem assinatura → assinatura explícita → reinício → documento e hash preservados. Distinto do laudo de acesso, sem prazo/incapacidade preenchidos automaticamente.
- Finalização inicial mantém uma única FLASH_EVOLUCAO e documento FLASH_RESUMO_CASO próprio.
- PATH-MOL permanece em pedidos de exames; sinais de alarme permanecem em orientações.

Todas as asserções originais permanecem. Falha ou cenário bloqueado produz código de saída não zero, para que o CI não confunda relatório produzido com jornada aprovada.
