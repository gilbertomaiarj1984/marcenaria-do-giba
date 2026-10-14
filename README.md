# Marcenaria do Giba

Aplicação para desenhar móveis visualmente e, no final, saber quantas chapas comprar e como cortá-las.
Feita para quem tem conhecimento básico de marcenaria. O primeiro móvel é uma estante com nichos para discos de vinil, portas e gavetas.

## O que já faz

- Editor 3D da estante: largura, altura, profundidade, rodapé, colunas e linhas.
- Cada vão pode ser nicho, porta ou gaveta. Dá para tirar divisórias e prateleiras e juntar nichos em áreas maiores.
- Várias gavetas empilhadas num vão; porta com lado da dobradiça escolhido, porta dupla, ou uma porta só na frente de vários nichos mantendo as prateleiras.
- Ver portas e gavetas abertas.
- Medidas no desenho: externas, de cada nicho e da seleção de vários nichos (vão livre e por fora das chapas).
- Espessura da chapa do corpo: 15, 18 ou 25 mm (MDF). Fundo em HDF 6 mm.
- Ferragens: dobradiça caneco 35 mm (quantidade pela altura da porta) e corrediça telescópica (comprimento pela profundidade).
- Sugestões: nicho pequeno para LP, prateleira que pode empenar com o peso dos discos, gaveta sem espaço, dobradiça errada para o tipo de porta.
- Lista de peças com medidas de corte.

## Regras de construção

- Laterais inteiras; base e tampo entre as laterais; divisórias entre base e tampo; prateleiras fixas entre divisórias.
- Fundo pregado atrás, cobrindo do rodapé para cima.
- Portas e frentes de gaveta sobrepostas, cobrindo metade da chapa em volta do vão, com 3 mm de folga entre frentes.
- Caixa da gaveta: 12,5 mm de folga por lado para a corrediça e 40 mm de folga na altura.

- Plano de corte: quantas chapas comprar, desenho de cada chapa com as peças (corte em guilhotina, como na seccionadora), medida da chapa, espessura da serra, refilo e opção de respeitar o veio. Exporta em PDF.

## Próximos passos

1. Importar imagem de inspiração para a IA sugerir medidas e divisões.

## Rodar

```bash
npm install
npm run dev     # abre em http://localhost:5173
npm test
```

O modelo do móvel fica em `src/model` e não depende da interface, para ser reaproveitado no plano de corte.
