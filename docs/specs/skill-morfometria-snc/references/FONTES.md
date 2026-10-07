# Fontes e alcance — skill v4.0.0

Consulta: 1 de outubro de 2026. Fontes clínicas e técnicas servem de fundamentação;
não validam clinicamente a skill nem o código produzido. As regras de segurança,
modos de operação e contratos de saída são propostas de engenharia desta versão.

## R1 — Limites da visão de modelos
OpenAI. **Images and vision**, seção Limitations.
https://developers.openai.com/api/docs/guides/images-vision

Alcance: limitações em localização espacial precisa, redimensionamento, metadados
e uso com imagens médicas especializadas. Não descreve a implementação interna
exata desta sessão nem dá acesso a pesos, mapa de atenção ou segmentação por voxel.

## R2 — Coordenadas, posição, orientação e espessura
DICOM PS3.3. **C.7.6.2 Image Plane Module**.
https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_C.7.6.2.html

Alcance: ImagePositionPatient, ImageOrientationPatient, PixelSpacing, índices,
SliceThickness, SpacingBetweenSlices e significado de SliceLocation. As equações
no pacote usam explicitamente índices de centros base zero.

## R3 — Ordem e significado do espaçamento
DICOM PS3.3. **10.7 Basic Pixel Spacing Calibration Macro**.
https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_10.7.html

Alcance: primeiro valor é espaçamento entre linhas; segundo, entre colunas;
calibração e diferenças entre espaçamento do paciente, detector e outros contextos.
Não atribui uma incerteza universal de 1%, 3%, 6% ou 8% a medidas clínicas.

## R4 — Transformações voxel→espaço físico
NiBabel. **Coordinate systems and affines**.
https://nipy.org/nibabel/coordinate_systems.html

Alcance: coordenadas voxel e transformação affine para coordenadas de referência.
A fórmula de volume por determinante é uma derivação geométrica. A origem clínica
e a integridade do affine continuam exigindo verificação.

## R5 — Fonte original RANO-BM
Lin NU, Lee EQ, Aoyama H, et al. **Response assessment criteria for brain metastases:
proposal from the RANO group**. Lancet Oncology. 2015;16:e270–e278.
DOI: 10.1016/S1470-2045(15)70057-4. PMID: 26065612.
https://pubmed.ncbi.nlm.nih.gov/26065612/

Alcance consultado: resumo e identificação da recomendação original. O texto integral
da editora não ficou acessível nesta consulta; os pormenores morfométricos foram
conferidos na aplicação em R11. Não alegar leitura integral de R5. O módulo entregue
é pré-avaliação morfométrica, não implementação completa dos critérios de resposta.

## R6 — Padronização da aquisição e limites da avaliação por imagem
Kaufmann TJ, Smits M, Boxerman J, et al. **Consensus recommendations for a standardized
brain tumor imaging protocol for clinical trials in brain metastases**.
Neuro-Oncology. 2020;22:757–772. DOI: 10.1093/neuonc/noaa030.
https://academic.oup.com/neuro-oncology/article/22/6/757/5734626

Alcance: BTIP-BM, aquisição pré/pós-contraste, consistência de exames, informação
clínica necessária e limitações de técnicas avançadas no contexto pós-tratamento.
A skill não prescreve um protocolo de aquisição para paciente individual.

## R7 — Propagação de incerteza e covariâncias
Taylor BN, Kuyatt CE. NIST Technical Note 1297, 1994 edition.
**Guidelines for Evaluating and Expressing the Uncertainty of NIST Measurement Results**.
https://nvlpubs.nist.gov/nistpubs/Legacy/TN/nbstechnicalnote1297.pdf

Alcance: incerteza-padrão, componentes, covariâncias e propagação. PDF consultado;
a página de incerteza combinada foi inspecionada também por renderização.
Não fornece valores de incerteza específicos para fotos de TC/RM.

## R8 — Monte Carlo para propagação de distribuições
JCGM 101:2008. **Evaluation of measurement data — Supplement 1 to the Guide to the
expression of uncertainty in measurement — Propagation of distributions using a
Monte Carlo method**. BIPM/JCGM.
https://www.bipm.org/documents/20126/2071204/JCGM_101_2008_E.pdf

Alcance: propagação de distribuições de entrada em modelos de medição. Não autoriza
inventar distribuições, independência ou intervalo de confiança para segmentações.

## R9 — Homografia e geometria projetiva
OpenCV. **Basic concepts of the homography explained with code**.
https://docs.opencv.org/4.x/d9/dab/tutorial_homography.html

Alcance: transformação entre planos e correspondências geométricas. A referência
métrica no paciente e a validação da foto são requisitos adicionais desta skill.

## R10 — Região física, anisotropia e reamostragem
SimpleITK. **Fundamental Concepts**.
https://simpleitk.readthedocs.io/en/master/fundamentalConcepts.html

Alcance: origem, espaçamento, direção, extensão física dos voxels e reamostragem.
Não substitui confirmação da unidade ou da procedência de uma exportação.

## R11 — Aplicação com descrição explícita da mensurabilidade RANO-BM
Ocaña-Tienda B, et al. **Volumetric analysis: Rethinking brain metastases response
assessment**. Neuro-Oncology Advances. 2024;6:vdad161.
DOI: 10.1093/noajnl/vdad161.
https://academic.oup.com/noa/article/6/1/vdad161/7468160

Alcance consultado: artigo integral, seção Assessment of Response. Descreve realce,
maior diâmetro axial de pelo menos 10 mm, perpendicular de pelo menos 5 mm e presença
em dois ou mais cortes; diferencia diâmetro axial do máximo volumétrico. O estudo
adota adaptações próprias para sua análise por lesão: essas adaptações NÃO foram
copiadas como regras universais de resposta na skill.

## R12 — Restrição à difusão não equivale a abscesso confirmado
Hartmann M, Jansen O, Heiland S, et al. **Restricted diffusion within ring enhancement
is not pathognomonic for brain abscess**. AJNR. 2001;22:1738–1742. PMID: 11673170.
https://pubmed.ncbi.nlm.nih.gov/11673170/

Alcance: achado de pesquisa original que impede tratar restrição como prova isolada
de abscesso. A skill não implementa diagnóstico diferencial nem um classificador.
