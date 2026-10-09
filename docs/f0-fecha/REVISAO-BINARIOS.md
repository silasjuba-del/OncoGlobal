# Revisão complementar dos binários publicáveis

09/10/2026, Astra. Revisão somente de leitura, usando pypdf para inventário e pypdfium2 para renderização local, sem dependência instalada. Não houve alteração dos documentos nem avaliação clínica das recomendações.

| Arquivo | Cobertura visual adicional | Resultado |
|---|---|---|
| docs/referencias/apac-laudo-solicitacao-autorizacao.pdf | página física 1 | Formulário APAC em branco, campos de identificação sem preenchimento. |
| docs/referencias/externos/manual-paciente-oncologico-2023.pdf | páginas físicas 1, 3, 4, 5, 6, 7, 8, 11 | Material editorial de orientação, imagens ilustrativas, logotipo, campos de consulta em branco; não há prontuário individual identificado nas páginas revisadas. |
| docs/referencias/externos/manual-quimioterapia-orientacoes.pdf | páginas físicas 3, 4, 8, 10, 11, 12, 13, 14, 15, 26, 29, 30, 31 | Imagens editoriais de instalações, vias de administração, lenços e cateteres. Contatos são institucionais do manual, já triados no texto; não há laudo individual preenchido nas páginas revisadas. |
| docs/referencias/kit-oncologia-2026-05.pdf | inventário: 5 páginas com texto, nenhuma imagem detectada por pypdf | Cobertura textual existente; sem dispensa visual adicionada por suposição. |

As páginas acima foram renderizadas em seis pranchas e duas páginas individuais (30 e 31: fundos de cor sem texto/identificação), abertas pela Astra; arquivos intermediários preservados localmente em `.git/f0-fecha-audit/pdf-visual/`. As revisões são vinculadas ao SHA do PDF e à lista de páginas no manifesto. Não se presume que pessoas em fotografia editorial sejam fictícias nem se infere sua saúde.

Para `docs/referencias/protocolos/protocolos-citotoxicos-revisado-silas.xlsx`, o ZIP foi inspecionado: nenhum comentário, mídia embutida ou elemento headerFooter nas worksheets; docProps contém apenas autoria técnica do gerador openpyxl, aplicação e datas técnicas. Revisão registra explicitamente comments, headers_footers, docProps e embedded_images. As células mantêm a extração textual e disposições existentes. Mudança do ZIP invalida a revisão pelo hash.

Limites: revisão visual e de estrutura desses bytes, não auditoria de todo conteúdo oculto possível, de histórico Git nem anonimização universal. O scanner mantém pendência quando formato/parte não tem cobertura declarada válida.
