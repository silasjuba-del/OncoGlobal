# Matemática, convenções e limites de implementação

Complemento da skill v4.0.0. Fórmulas geométricas não validam o contorno anatômico.
Notação: comprimentos em mm, áreas em mm², volumes em mm³; 1000 mm³ = 1 mL.
As referências R1–R12 estão em FONTES.md. Exemplos abaixo são estritamente sintéticos.

## 1. Pixel, voxel e resolução não são sinônimos

Um raster de foto tem pixels da fotografia. Uma matriz de TC/RM amostra uma região
física; cada amostra pode ser associada a uma célula/voxel na grade especificada.
A resolução efetiva do sistema não é determinada apenas pelo espaçamento da grade.
Uma foto de um corte não observa a terceira dimensão.

Para N colunas de espaçamento s_c, a distância entre centros extremos é
(N−1)*s_c; a extensão das N células completas é N*s_c. Misturar bordas de células
com centros gera erro de meio pixel em cada extremidade. [R2,R10]

Contornos entre pixels devem declarar a convenção: por exemplo, coordenadas
contínuas no sistema em que (0,0) é o centro da primeira célula. Não somar nem
subtrair meio pixel automaticamente sem conhecer a convenção do algoritmo.

## 2. Transformação DICOM

PixelSpacing=(s_r,s_c). IOP=(X,Y), com dois vetores unitários e ortogonais.
Com O_j a origem física do frame j:

    P(r,c,j) = O_j + c*s_c*X + r*s_r*Y.

Num array NumPy, índices normalmente aparecem como [frame,linha,coluna]. A ordem
da biblioteca de imagens pode ser diferente; não inferir a ordem pelo nome da variável.
O vetor X da DICOM corresponde à direção da linha, percorrida ao incrementar a
coluna. Essa nomenclatura é uma fonte importante de troca de eixos. [R2,R3]

Se a posição de cada corte admite O_j=O_0+j*w, uma grade regular possui base
B=[s_c*X, s_r*Y, w] para índices ordenados como [c,r,j]. Se o array usa outra ordem,
permutar as colunas de B de modo correspondente. Uma reflexão muda o sinal do
determinante, não o volume, que usa seu valor absoluto.

Para cortes paralelos, n=(X×Y)/||X×Y|| e z_j=O_j·n. O incremento normal é a
diferença ordenada de z_j. Um w com componente no plano pode representar grade
cisalhada; ||w|| não é a separação perpendicular entre planos.

Se IOP muda entre cortes, uma única matriz affine pode ser inválida para a pilha.
Nesse caso, tratar a geometria por frame ou reconstruir com método verificado,
sem aplicar cegamente uma mediana de espaçamentos.

## 3. Distância anisotrópica e derivadas

Definindo dc=c2−c1, dr=r2−r1:

    D = sqrt((s_c*dc)^2 + (s_r*dr)^2).

Para x=(dc,dr,s_c,s_r), quando D>0, o Jacobiano é:

    dD/ddc  = s_c²*dc/D
    dD/ddr  = s_r²*dr/D
    dD/ds_c = s_c*dc²/D
    dD/ds_r = s_r*dr²/D.

Com matriz de covariância Sigma para essas variáveis:

    u_D² ≈ J Sigma J^T.

Se os extremos têm covariâncias C1 e C2, e C12=Cov(p1,p2), então para o vetor
diferença q=p2−p1:

    Cov(q) = C1 + C2 − C12 − C12^T.

Com e=q/||q||, uma aproximação para a incerteza de comprimento é
u_D² ≈ e^T Cov(q) e, antes de acrescentar componentes de calibração que não estejam
já representadas nessa covariância. Não duplicar o mesmo componente.

A hipótese de quantização uniforme de um extremo ao longo de uma coordenada em
[−0,5,+0,5] pixel produz desvio-padrão 1/sqrt(12) pixel. Isso é uma hipótese de
quantização, NÃO o erro total da borda de uma lesão. Blur, contraste, segmentação
e volume parcial podem dominar; não adotar esse valor como precisão clínica.

## 4. Foto calibrada e transformações

Para uma régua clínica de comprimento R e extensão l no raster: k=R/l.
Para a lesão com extensão L no mesmo sistema: D=L*R/l.

Se L,R,l são tratados como variáveis, propagar a covariância de todos os três:

    dD/dL = R/l; dD/dR = L/l; dD/dl = −L*R/l².

Escala e comprimento podem compartilhar incerteza. Recontar a mesma régua não
cria uma fonte independente. Um caliper copiado da geometria nativa compartilha
parte dessa geometria.

Quando u'=f(u,v), v'=g(u,v) é uma homografia, a escala local pode variar com a
posição. Primeiro transformar extremos E contorno; depois calcular as distâncias
em coordenadas métricas. Para área, transformar o polígono ou integrar
|det J_T(u,v)| na região original. Um único k não representa uma perspectiva
variável. [R9]

Ajustar quatro correspondências sem redundância pode produzir resíduo zero por
construção. Para avaliar o ajuste, usar pontos adicionais não usados no ajuste
quando disponíveis; resíduos de ajuste não quantificam sozinhos a distorção de lente.

## 5. Diâmetros distintos

D_Feret_2D = máximo da distância entre pontos do contorno físico em um plano.
D_axial = máximo dos D_Feret_2D nos cortes axiais adequados da mesma lesão.
D_3D = máximo da distância entre pontos da superfície em coordenadas físicas.

D_3D pode ser maior que D_axial. Nenhum deles equivale automaticamente ao maior
eixo de uma elipse ajustada ou à maior dimensão de uma caixa delimitadora.

Em contornos não convexos, o segmento de Feret pode cruzar regiões fora do objeto.
A definição geométrica continua válida, mas a definição clínica de caliper pode
exigir revisão. Não promover um máximo geométrico a medida protocolar sem verificar
qual estrutura/compartimento e quais limites foram selecionados.

Usar casco convexo preserva o par de maior distância do conjunto de pontos dado.
Reduzir pontos por amostragem aleatória não preserva necessariamente esse máximo.
Para superfícies 3D muito grandes, uma implementação especializada precisa registrar
se trabalha com vértices, centros de voxels, superfície interpolada ou outra convenção.

## 6. Área e volume por células

Para vetores físicos de incremento a,b no plano:

    A_celula = ||a×b||.

No caso ortogonal, A_celula=s_r*s_c. A área de uma máscara binária é a soma das
áreas das células selecionadas, dentro dessa definição de discretização.

Para vetores a,b,c de uma grade volumétrica regular:

    V_celula = |a·(b×c)| = |det(B)|, com B=[a,b,c].
    V = soma(M_ijk)*V_celula.

O volume é exatamente o volume das células selecionadas sob a geometria fornecida;
isso não o torna o volume anatômico exato. Há erro de aquisição e fronteira.

Escalonar todas as distâncias por s escala áreas por s² e volumes por s³.
Assim, um erro de calibração comum que parece pequeno no diâmetro pode ser mais
relevante no volume. Não somar volume de realce com envelope que já o contém.

Contar probabilidades como soma(p_ijk)*V_celula só estima uma expectativa sob
um modelo probabilístico adequado. Probabilidade de classe não é automaticamente
fração física de voxel ocupada pelo tecido.

## 7. Cortes irregulares e polos

Para áreas A_j em posições z_j crescentes:

    V_intervalo ≈ soma((A_j+A_(j+1))/2 * (z_(j+1)−z_j)).

Isso é regra do trapézio com aproximação linear de área entre centros. Mesmo
com todas as áreas corretamente contornadas, pode haver erro de quadratura.
São necessários limites e contribuições terminais; a integral entre os centros
do primeiro e do último corte positivo não inclui, por si só, os polos completos.

No método por lâminas:

    V ≈ soma(A_j*h_j), h_j=b_(j+1)−b_j.

Os b_j precisam representar limites definidos, não espessuras duplicadas ou
gaps omitidos. Cortes com espessura maior que o incremento espacial se sobrepõem
na aquisição: não somar cada área vezes a espessura como se fossem lâminas disjuntas.

Zeros adicionados artificialmente além de uma lesão truncada não demonstram que
a lesão terminou ali. A função trapezoidal do pacote exige áreas terminais zero
fornecidas pelo chamador e verificação externa de que esses cortes foram observados.

## 8. Incerteza de volume e covariâncias

Para V=N*s_x*s_y*s_z, quando N e espaçamentos admitem modelo de incerteza:

    J = (s_x*s_y*s_z, N*s_y*s_z, N*s_x*s_z, N*s_x*s_y)
    u_V² ≈ J Sigma J^T.

O N de uma máscara binária é um resultado discreto de segmentação. Estimar sua
incerteza exige variabilidade de máscaras ou modelo de fronteira, não apenas
assumir sqrt(N) ou amostrar cada voxel de forma independente.

Uma perturbação global de escala deve afetar todos os voxels de uma amostra
Monte Carlo de modo coerente. A incerteza de borda tende a ser espacialmente
correlacionada; ruído Bernoulli independente pode produzir máscaras impossíveis.

## 9. Monte Carlo e análise de sensibilidade

Usar apenas distribuições fundamentadas. Procedimento proposto:
1. Definir entradas aleatórias e dependências; distinguir incerteza quantificada
   de limitações estruturais não quantificadas.
2. Gerar uma realização de escala/geometria e uma máscara/contorno plausível.
3. Medir usando exatamente a mesma definição em todas as realizações.
4. Repetir, registrar semente e verificar convergência dos quantis em relação
   à resolução de relato escolhida.
5. Reportar mediana/quantis como resultado condicionado às premissas do modelo,
   não como certeza de que o volume anatômico verdadeiro está naquele intervalo.

Uma escolha como 2000 ou 10000 amostras não cria validade. A precisão Monte Carlo
não elimina um viés estrutural do contorno ou uma calibração errada. [R8]

Quando só se pode propor bordas internas e externas, preferir faixa de cenários
[D_interno,D_externo] ou [V_interno,V_externo], informando a construção; não renomear
como IC95%. Não há Monte Carlo implementado no núcleo entregue.

## 10. Repetibilidade, concordância e validação

A amplitude de três números informa dispersão, não a verdade. Num exemplo
sintético, três medidas iguais de 25 mm concordam perfeitamente e ainda podem
estar erradas diante de uma referência de 20 mm.

Medidas repetidas pelo mesmo modelo, a partir da mesma imagem e mesmo contorno,
não são réplicas independentes de aquisição ou de observador.

Para máscaras em uma grade comum, Dice=2|A∩B|/(|A|+|B|) pode descrever sobreposição,
mas não prova correta calibração, diagnóstico ou contorno verdadeiro. Métricas de
superfície devem usar distâncias físicas e declarar sua definição e amostragem.
Nenhum limiar genérico de Dice é imposto por esta skill.

Uma validação clínica posterior deve separar erro de escala, erro de segmentação,
seleção do corte, reprodutibilidade entre leitores e desempenho por tipo de fonte.
Casos fotografados não devem ser usados como sua própria referência-verdade.

## 11. O que o código entregue cobre

Implementado: conversão de pontos DICOM mediante metadados fornecidos; ordenação
geométrica de planos paralelos; distâncias/Feret sobre bordas fornecidas; escala por
razão de comprimentos; área de máscara; volume de grade regular; trapézio; propagação
linear de incerteza; dispersão descritiva.

Não implementado: reader DICOM/Enhanced, decodificação de pixels comprimidos,
seleção de séries, verificação de identidade, desidentificação, segmentação,
correção de homografia/lente, detecção de emergência, inferência de contraste,
extração automática de RANO, avaliação de resposta ou validação clínica.

O número de testes aprovados refere-se exclusivamente ao código testado, não a
todos os itens do fluxo operacional proposto na skill.
