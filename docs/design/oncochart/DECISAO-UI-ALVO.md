# OncoChart = UI-alvo do OncoGlobal (D-W9-35)

> Dr. Silas, 2026-10-06: "ESSA É A UI QUE QUERO". Fonte: `C:\Users\silas\GENSPARK-CODE\project (1)` (handoff de design, dados 100% fictícios). Copiado aqui integralmente (README = especificação pixel a pixel). Referência visual: `assets/ref.png`.

## O que vira alvo
- Layout: canvas 1680×1000 escalado; grade **Rail 58 px · Main · Side 396 px**; Topbar (breadcrumb, busca Ctrl K → paleta, DIA/NOITE com revelação circular, alertas, usuário).
- **PatientHeader**: avatar, nome, chips (diagnóstico, alergia em destaque, ECOG, biomarcadores), card de diagnóstico (CID, TNM, estádio, ECOG), botão **Consulta Flash**.
- **Timeline 2D** com miniaturas de exames e marcador HOJE; botão **Ver em 3D**.
- Abas: Visão geral · Quimioterapia (Cn) · Dados clínicos · Evolução (indicador deslizante).
- Cards: Protocolos ativos, Documentos recentes (soltar PDF = caixa única D-W9-18), Estadiamento e avaliações (TNM/RECIST/ECOG/CTCAE "não preenchido" = PENDENTE), Rascunho de evolução.
- Painel lateral: Exame selecionado (Resumo/Laudo/Imagens), **OncoBoard** (a fazer / em discussão / concluído), agenda/gráficos, fila com "Chamar próximo".
- **Dock** flutuante: mic · Novo registro · Solicitar exame · Ciclo QT · Tumor-pack · Trials · Jornada 3D · Encerrar·WhatsApp.
- Overlays: visualizador de imagem, áudio, encerramento, tumor-pack, trials, interações, **Liberação QT (gates)**, Flash, Dx/CID versionado, paleta.
- **Jornada 3D** (linha do tempo em profundidade), **Chart3D** (RECIST e skyline de toxicidade), **OncoAssist** avatar com narração.
- Tokens oklch, fontes Geist/Geist Mono, motion `--ease`/`--spring`.

## Ajustes obrigatórios (regras do projeto prevalecem sobre o desenho)
| No desenho | No OncoGlobal |
|---|---|
| CTCAE v5 no skyline | **CTCAE v6** (Q45); grau só confirmado pelo médico |
| Dicas do OncoFab com conduta ("Fluoxetina × tamoxifeno: trocar antes da HT") | OncoAssist **aponta** achado/interação e fonte; não recomenda conduta (IA não define conduta, D-W9-24) |
| "C11 liberado · todos os gates OK" | Liberação = portões do salão/bula (D-W9-22a); "liberado" só após validação humana; ausente = PENDENTE |
| Narração por voz (Web Speech pt-BR) | Permitida só local (síntese do navegador, sem envio); texto narrado sem PHI fora do PC |
| `localStorage` | Só preferências de UI; dado clínico no ledger local |
| React/Babel via CDN, fontes Google | Recriar em `src/ui` (React 19 + Vite já do projeto), fontes empacotadas localmente (sem CDN em produção) |
| Amarelo/âmbar em G2 e estados | Semáforo do app: VERDE/VERMELHO/PENDENTE, teto de 5 estados; âmbar só como cor de série de gráfico |
| Paleta oklch escura | Convive com DIA/NOITE/PERSONALIZAR (D-W9-16); **decidido (D-W9-40): OncoChart é o padrão** (NOITE do desenho + DIA derivado); tokens da Muse = base de contraste AA |
| Modelo visual anterior (D-W5-07, `ui-modelo-consulta.webp`) | **Substituído** pelo OncoChart; regras do app continuam prevalecendo |

## Execução
Porte para React/TS em `src/ui` = onda de UI (Cursor) após W9; usa os dados reais via `src/ui/api` (sem `data.js`). Jornada 3D e Chart3D em CSS 3D (≤200 caixas) antes de considerar react-three-fiber (dependência nova = aprovação).

## OncoAssist explica a imagem (D-W9-40)
No ImageViewer, o OncoAssist narra **o laudo e os achados extraídos** (trecho-fonte clicável), sem diagnosticar nem medir. Pixel → IA só após sanitizador G-27 e provider aprovado.
