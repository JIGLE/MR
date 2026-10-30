---
title: "Exemplo: cinco aldeias de xisto para descobrir sem pressa"
subtitle: Um artigo de demonstração que mostra capa, imagens no texto e a cópia da página original.
outlet: evasoes
date: 2018-05-12
section: Viagens
tags: [Viagens, Portugal, Aldeias]
originalUrl: https://www.evasoes.pt/exemplo
archiveUrl: https://arquivo.pt/wayback/20180601000000/https://www.evasoes.pt/exemplo
medium: web
cover: ./capa.jpg
coverAlt: Colinas ao fim da tarde
coverCaption: Imagem de demonstração. Nos artigos reais, a legenda e o crédito da fotografia original ficam aqui.
attachments:
  - file: ./snapshot.html
    label: Cópia da página como foi publicada
sample: true
notes: Exemplo. Apagar esta pasta quando houver artigos reais.
---

Este é um **artigo de exemplo**. Serve para mostrar como fica um texto no arquivo:
o corpo do artigo é escrito em Markdown, e as imagens ficam guardadas na mesma pasta,
ao lado do texto, para nunca dependerem do site original.

## As imagens dentro do texto

Uma imagem a meio do artigo escreve-se assim, com o caminho relativo ao ficheiro:

![Rua de uma aldeia, imagem de demonstração](./rua.jpg)

*Legenda da fotografia, tal como aparecia no original.*

O site gera versões mais leves para o browser, mas o ficheiro original fica intacto no repositório.

> Citações destacadas também se preservam, como esta.

## Vídeos e outros elementos

Um vídeo incorporado (por exemplo, do YouTube) pode ser colado diretamente como HTML.
Para garantir que não se perde, guarde também uma cópia do vídeo na pasta e liste-a em `attachments`.
