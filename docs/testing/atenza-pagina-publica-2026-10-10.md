# Página pública do Atenza — validação de 10/10/2026

## Escopo

Implementação do conceito aprovado, com conteúdo HTML responsivo, imagens
contextuais, demonstração fictícia, integrações animadas e vídeos locais.
Os resolvedores de marca, país, preços, autenticação e captação existentes
foram preservados. Não houve alteração de schema nem envio comercial.

## Prova executada em navegador

Revisão independente com Chromium/Playwright em 320, 390, 768 e 1440 px:

- HTTP 200, sete imagens carregadas, nenhum overflow horizontal, erro de
  JavaScript ou falha HTTP; zero violações axe em cada largura.
- Abas de conversas, agentes e funil operantes; movimentação local do cartão
  para Concluído. Exemplos explicitamente identificados como fictícios.
- Loop de oito segundos reproduzido sem áudio; pausa manual, suspensão fora
  da tela e manutenção da pausa voluntária comprovadas.
- Duas faixas em direções opostas, com pausa. Movimento reduzido impede o
  carregamento automático do vídeo e mantém as integrações estáticas.
- Menu móvel fecha por âncora e Escape, devolvendo o foco ao botão.
- Preços e condições em português, inglês e espanhol conferidos. A declaração
  global `html lang=pt-BR` já existente continua como limitação nas versões
  traduzidas; não foi ampliada a alteração ao layout global.
- `/login`, `/signup`, `/contato`, `/legal`, `/legal/privacy` e `/legal/terms`
  acessíveis sem submissão de formulários nem criação de contas reais.

## Regressão de acesso à mídia

`tests/unit/midia-publica-da-vitrine.test.ts`: nove casos. Antes do conserto,
os três arquivos públicos de vídeo e legenda eram indevidamente tratados
como privados: três falhas previstas, seis casos negativos aprovados.
Depois da lista fechada em `lib/auth/public-paths.ts`, nove aprovados.
O GET anônimo com Range do MP4 retornou 206 e `video/mp4`.
A correção não libera mídia de clientes ou extensões arbitrárias.

Os testes de componentes cobrem carregamento sob demanda, preferências de
movimento/dados, reprodução após clique e navegação por teclado. Os gates
de conteúdo traduzido continuam cobrindo a página.

## Mídia

Origem e tratamento das fotografias e do loop:
`docs/marketing/atenza-assets-2026-10-10.md`.
O explicativo tem 48 segundos, H.264/AAC 1280 × 720, faststart, áudio
normalizado em −16 LUFS e reprodução iniciada por clique. Legendas e
transcrição acompanham o vídeo. Voz sintética; sem depoimento fictício.

Os resultados da integração contínua e da publicação devem ser consultados
no commit publicado e no respectivo deployment. A prova visual local usa
o Supabase de teste, sem Docker; não refaz as jornadas autenticadas nem os
testes de banco da entrega anterior.
