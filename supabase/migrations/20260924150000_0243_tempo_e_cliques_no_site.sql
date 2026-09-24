-- Migration 0243 — quanto tempo a pessoa ficou, e onde ela clicou.
--
-- ─── O que faltava, e por que importa ───────────────────────────────────────
--
-- `site_visits` (0240) responde QUEM chegou, DE ONDE e o QUE virou. Não
-- responde o que acontece ENTRE chegar e sair — e é aí que mora a diferença
-- entre uma página que não converte porque ninguém a lê e uma que não converte
-- porque a leem inteira e mesmo assim não clicam. As duas têm a mesma taxa de
-- conversão e conserto oposto.
--
-- ─── Duas peças, e por que uma é coluna e a outra é tabela ──────────────────
--
-- `segundos_na_pagina` é COLUNA de `site_visits`: há no máximo um valor por
-- visita, ele chega depois (quando a aba é escondida) e atualiza a linha que
-- já existe. Tabela à parte exigiria um join para responder "quanto tempo
-- ficou quem veio do Instagram?", que é a pergunta mais óbvia que este dado
-- permite.
--
-- `site_clicks` é TABELA: uma visita tem N cliques, e o volume é maior que o
-- de visitas. Separada, ela é expurgável por idade sem tocar na visita — a
-- mesma razão pela qual `site_visits` e `site_leads` já são separadas (ver o
-- cabeçalho da 0240).
--
-- ─── O que NÃO é gravado, e isso é o desenho ────────────────────────────────
--
-- Nem IP, nem e-mail, nem conteúdo de campo, nem coordenada de clique. O que
-- se grava é o RÓTULO do elemento clicado — `plano-pro`, `cta-hero`,
-- `whatsapp-flutuante` —, escolhido por nós no código, nunca lido do DOM. Ler
-- o texto do elemento gravaria, um dia, o que alguém digitou num campo cujo
-- rótulo mudou; um vocabulário fechado não tem como escorregar para isso.
--
-- `visitor_id` e `session_id` são os MESMOS de `site_visits`: identificadores
-- que nós geramos, guardados em cookie de primeira parte, que não identificam
-- pessoa nenhuma fora deste domínio.

-- ── 1. Quanto tempo ficou ───────────────────────────────────────────────────
--
-- `integer` e não `interval`: a unidade é segundo, o consumidor é um painel
-- que faz média, e `interval` obrigaria todo `avg()` a um cast. Nulo significa
-- "a pessoa saiu sem que o navegador conseguisse avisar" — fechar a aba na
-- força bruta, perder a rede, matar o app. Nulo é o estado honesto disso, e
-- zero seria mentira (ela esteve lá).
alter table public.site_visits
  add column if not exists segundos_na_pagina integer;

comment on column public.site_visits.segundos_na_pagina is
  'Segundos com a aba visível. NULL = o navegador não conseguiu avisar na saída.';

-- ── 2. Onde clicou ──────────────────────────────────────────────────────────
create table if not exists public.site_clicks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Os mesmos identificadores de `site_visits`. SEM foreign key de propósito:
  -- o clique pode chegar depois de a visita ter sido expurgada por idade, e uma
  -- FK faria esse clique ser RECUSADO — perdendo o dado por causa da ordem de
  -- limpeza, que é o oposto do que se quer.
  visitor_id text not null,
  session_id text not null,
  -- A página em que o clique aconteceu. `path`, nunca a URL inteira: query
  -- string carrega o que alguém colou lá.
  path text not null,
  -- O rótulo do elemento, do vocabulário fechado que o código define.
  alvo text not null
);

-- A consulta do painel é sempre "cliques dos últimos N dias, agrupados por
-- alvo". Este índice cobre o recorte; o agrupamento é barato sobre ele.
create index if not exists site_clicks_created_idx
  on public.site_clicks (created_at desc);

create index if not exists site_clicks_alvo_idx
  on public.site_clicks (alvo, created_at desc);

-- RLS `deny all`, como as tabelas irmãs da 0240: isto é do OPERADOR da
-- instalação, não de organização nenhuma. Quem lê é o painel em /dashboard,
-- pela chave de serviço, atrás da senha própria dele.
alter table public.site_clicks enable row level security;

revoke all on public.site_clicks from anon, authenticated;
grant all on public.site_clicks to service_role;
