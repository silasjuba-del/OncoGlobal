# Portas de entrada do OncoGlobal

> Tabela do Dr. Silas (2026-10-06), preenchida conforme ele envia. Cada porta alimenta a caixa de revisão (D-W9-34a) e o pipeline de extração (D-W9-33).

| Porta | Quem usa | Exemplo consultório | Estado |
|---|---|---|---|
| **Página do paciente** | Paciente / familiar | Formulário pré-consulta, upload de exame, intercorrência | Registrada — ver nota (D-W9-46) |
| Caixa única (consulta) | Médico | Colar texto, soltar PDF/Word (D-W9-18) | Decidida |
| Plaud / voz | Médico | Transcrição desidentificada (A8), comando curto (A9) | Decidida |
| Canal WhatsApp | Paciente | Mensagens, red flags (A10, D-W9-28) | Decidida (envio desligado até vínculo + consentimento) |
| Foto de prescrição/laudo | Médico/equipe | Reconciliação com template (D-W9-45) | Decidida |
| Agent Reach | Sistema | Conhecimento externo, sem PHI (D-W9-42) | Ideia |

## Nota tech lead · Página do paciente (D-W9-46)
Uma página acessada pelo paciente fora do consultório exige o app **exposto à internet** e recebe dado de saúde de fora — conflita com "dados só no PC" (v1 local, monousuário). Caminhos compatíveis:
1. **v1 pelo canal WhatsApp (A10):** formulário pré-consulta como roteiro de perguntas, upload de exame como foto/PDF, intercorrência caindo nos red flags — tudo entra na caixa de revisão. Não exige servidor exposto.
2. **v2 página própria:** só com hospedagem segura (D-W9 nuvem não decidida), login do paciente, consentimento e LGPD — decisão futura do Dr. Silas.
Formulário pré-consulta, upload e intercorrência viram **tipos de entrada** com o mesmo destino (caixa de revisão), independentes do canal.
