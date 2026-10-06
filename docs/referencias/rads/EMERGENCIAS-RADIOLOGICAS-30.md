# Catálogo de emergências oncológicas radiológicas (30) · cadeias de palavras-chave

> Fonte: Dr. Silas, 2026-10-06 (sessão Claude "estatística - H.bem") — D-W9-51. Base do alerta RADS: o laudo é varrido pela **cadeia** (sequência de achados), não por palavra solta. Achado da cadeia ⇒ ALERTA VERMELHO com trecho do laudo; médico confirma. Nunca diagnóstico automático.

| # | Categoria | Emergência | Modalidade preferencial | Cadeia de palavras-chave no laudo |
|---|---|---|---|---|
| 1 | Compressão | Compressão medular metastática | RM coluna total | massa epidural → apagamento do saco dural → compressão → mielopatia |
| 2 | Compressão | Síndrome de veia cava superior | TC tórax +C | massa mediastinal → estenose/trombo de VCS → colaterais → edema |
| 3 | Compressão | Metástase cerebral com herniação | RM/TC crânio | massa → edema vasogênico → desvio de linha média → herniação uncal/subfalcina |
| 4 | Compressão | Compressão de cauda equina | RM lombossacra | massa sacral/lombar epidural → amputação de raízes → destruição óssea |
| 5 | Compressão | Hidrocefalia obstrutiva (fossa posterior) | TC/RM crânio | lesão cerebelar → colapso do 4º ventrículo → dilatação supratentorial → edema transependimário |
| 6 | Obstrução | Obstrução intestinal maligna | TC abdome | ponto de transição abrupto → distensão a montante → níveis hidroaéreos → carcinomatose |
| 7 | Obstrução | Uropatia obstrutiva maligna | TC/US | massa pélvica/retroperitoneal → hidronefrose → afilamento cortical |
| 8 | Obstrução | Obstrução de via aérea central | TC tórax/broncoscopia | massa endoluminal → estenose traqueal/brônquica → atelectasia completa |
| 9 | Obstrução | Obstrução biliar/colangite | colangio-RM/TC | sinal do duplo ducto → dilatação intra-hepática → realce parietal biliar |
| 10 | Obstrução | Obstrução de saída gástrica maligna | TC abdome | estômago de retenção → estenose piloro-duodenal → invasão pancreática |
| 11 | Perfuração | Perfuração de víscera oca | TC abdome | pneumoperitônio → gás extraluminal → coleção bloqueada → peritonite |
| 12 | Perfuração | Perfuração GI por antiangiogênico | TC abdome | pneumoperitônio → descontinuidade parietal → líquido livre |
| 13 | Perfuração | Fístula traqueoesofágica/mediastinite | TC tórax | gás mediastinal → trajeto fistuloso → contraste extraluminal → derrame pleural |
| 14 | Perfuração | Fístula anastomótica com abscesso | TC abdome +C | coleção com gás → extravasamento de contraste oral → densificação |
| 15 | Vascular | Tromboembolismo pulmonar | angio-TC tórax | falha de enchimento → dilatação de VD → desvio septal → infarto |
| 16 | Vascular | Tamponamento cardíaco | eco/TC tórax | derrame volumoso → colapso de câmaras direitas → plétora de VCI |
| 17 | Vascular | Hemorragia intratumoral cerebral | TC sem contraste | área hiperdensa intralesional → nível líquido-líquido → efeito expansivo agudo |
| 18 | Vascular | Ruptura de CHC/hemoperitônio | TC trifásica | CHC exofítico → hematoma sentinela → blush arterial → hemoperitônio |
| 19 | Vascular | Hemoptise maciça | angio-TC tórax | cavitação → erosão vascular → hipertrofia de artérias brônquicas |
| 20 | Vascular | Trombose mesentérica/portal | angio-TC abdome | falha em porta/VMS → espessamento de alças → pneumatose → gás portal |
| 21 | Vascular | Blowout carotídeo/pseudoaneurisma | angio-TC cervical | pseudoaneurisma → extravasamento ativo → hematoma → leito irradiado |
| 22 | Infecciosa | Colite neutropênica (tiflite) | TC abdome | espessamento cecal → densificação pericecal → pneumatose → sem pneumoperitônio |
| 23 | Infecciosa | Pionefrose/pielonefrite enfisematosa | TC abdome | hidronefrose → debris/gás parenquimatoso → perda de nefrograma |
| 24 | Infecciosa | Abscesso hepático/colangite supurativa | TC trifásica | coleções coalescentes → realce em alvo/periférico → gás intralesional |
| 25 | Infecciosa | Aspergilose angioinvasiva | TC tórax | nódulos com halo em vidro fosco → cavitação → crescente aéreo |
| 26 | Infecciosa | Fasceíte necrosante/Fournier | TC pélvica/perineal | gás em planos fasciais → espessamento → coleções dissecantes |
| 27 | Tratamento | Fratura patológica iminente | RX/TC | lesões líticas → afilamento cortical → SINS (coluna)/Mirels (ossos longos) |
| 28 | Tratamento | Pneumonite imunomediada/actínica | TC tórax | vidro fosco → padrão OP → sem coleção → limites do campo de RT |
| 29 | Tratamento | Colite imunomediada | TC abdome | espessamento mucoso contínuo → sinal do alvo → ingurgitamento vascular |
| 30 | Tratamento | Derrame pleural maligno sob tensão | RX/TC tórax | opacidade hemitorácica total → desvio mediastinal contralateral → atelectasia |

## Regras de uso (tech lead)
- Combina com INTERVAL_PROGRESSION (D-W9-43) e com a auditoria ACR (`docs/referencias/evidencias/`): ACR sugere o exame; esta tabela reconhece a emergência no laudo.
- Negação no laudo ("sem sinais de", "não há") anula o elo da cadeia (teste obrigatório com o laudo sintético PT08 de crânio = negativo).
- Lateralidade e nível (ex.: L5 à esquerda, rim direito) são extraídos junto (D-W9-05).
- Hidronefrose unilateral (PT08) cai na linha 7 como ALERTA; a "hidronefrose bilateral" do chat de arquitetura é agravante.
