# Análise morfométrica de lesão do SNC — v4.0.0

## Arquivos

- `SKILL.md`: skill operacional completa, substituindo a v3.1.
- `references/FONTES.md`: referências e alcance efetivamente consultado.
- `references/MATEMATICA.md`: equações, convenções e limites de implementação.
- `scripts/morfometria_core.py`: funções matemáticas de referência, dependentes de NumPy.
- `tests/test_morfometria_core.py`: testes unitários sintéticos.
- `tests/RESULTADO_TESTES.txt`: resultado da execução nesta entrega.

## Uso

O SKILL.md é um documento de instruções reutilizável. Sua inclusão numa plataforma
não instala bibliotecas nem torna disponível um PACS, um segmentador ou um reader
DICOM. A plataforma receptora deve declarar as ferramentas que realmente possui.

O núcleo Python recebe geometrias e máscaras já fornecidas. Para verificar os
cálculos em um ambiente que já tenha NumPy:

```bash
python -m unittest discover -s tests -v
```

Nenhuma dependência foi instalada nesta entrega. NumPy disponível no ambiente de
teste: 2.3.5. Os testes não usam imagens de paciente nem acesso à rede.

## Resultado da verificação

36 testes sintéticos aprovados na execução registrada. Foram verificados cálculos,
contratos de entrada e rejeições específicas. NÃO foram validados reconhecimento
visual de lesão, segmentação, análise DICOM ponta a ponta ou uso clínico.

Nenhum exame foi fornecido ou medido nesta tarefa. Nenhum arquivo foi enviado a
PACS, repositório, nuvem do usuário ou serviço externo de análise de imagem.
Nenhuma skill foi instalada automaticamente.

## Mudanças centrais em relação à v3.1

1. Separação entre percepção visual, raster 2D calibrado e volume geométrico.
2. Retirada de calibração por anatomia média e da correção automática por MF.
3. Geometria anisotrópica, orientação física, posição por corte e volume por determinante.
4. Incerteza fundamentada com covariância; sem percentuais fixos por tipo de arquivo.
5. Três verificações diferentes no lugar de três calibrações artificialmente independentes.
6. RANO-BM como pré-avaliação candidata, sem classificar resposta ou histologia.
7. Diferencial diagnóstico separado do fluxo padrão.
8. Preservação de limites, proveniência, contorno versionado e revisão humana.

**REVIEW_REQUIRED — confirmar a medida e o contorno em DICOM nativo, com revisão médica.**
