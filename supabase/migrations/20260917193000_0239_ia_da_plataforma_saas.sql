-- 0239 — IA da plataforma para o SaaS Whatsapp.
--
-- O cliente final deixa de trazer uma chave de Anthropic/OpenAI para o atendimento.
-- A organização escolhe comportamento, conhecimento e ferramentas; a infraestrutura
-- do SaaS fornece um endpoint OpenAI-compatível sob o provider lógico `saas_ai`.
--
-- Esta migration não grava segredo no banco. SAAS_AI_BASE_URL/SAAS_AI_API_KEY são
-- configuração da infraestrutura e continuam fora do Postgres.

-- Catálogo lógico. Os nomes são aliases estáveis expostos pelo gateway/cluster de IA;
-- trocar o modelo físico não exige regravar versões de agentes de todos os tenants.
update public.ai_models
   set is_default_for_provider = false
 where provider = 'saas_ai'
   and is_default_for_provider;

insert into public.ai_models
  (provider, model_id, display_name, description, context_window,
   input_price_per_million_cents, output_price_per_million_cents,
   supports_tools, is_default_for_provider, metadata, source, synced_at, supports_vision)
values
  ('saas_ai', 'platform-chat', 'IA do SaaS Whatsapp',
   'Modelo principal gerenciado pela plataforma, com uso de ferramentas.',
   131072, 0, 0, true, true,
   '{"managed_by":"saas_whatsapp","role":"chat"}'::jsonb, 'platform', now(), true),
  ('saas_ai', 'platform-fast', 'IA rápida do SaaS Whatsapp',
   'Alias de baixa latência para classificação, roteamento e tarefas auxiliares.',
   131072, 0, 0, true, false,
   '{"managed_by":"saas_whatsapp","role":"fast"}'::jsonb, 'platform', now(), false)
on conflict (provider, model_id) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  context_window = excluded.context_window,
  input_price_per_million_cents = excluded.input_price_per_million_cents,
  output_price_per_million_cents = excluded.output_price_per_million_cents,
  supports_tools = excluded.supports_tools,
  is_default_for_provider = excluded.is_default_for_provider,
  metadata = excluded.metadata,
  source = excluded.source,
  synced_at = excluded.synced_at,
  supports_vision = excluded.supports_vision,
  deprecated_at = null;

-- A contabilidade interna continua existindo mesmo quando o custo do tenant não é
-- o preço direto do fabricante. Zero aqui significa "não use tabela pública de
-- fabricante"; custo real da infraestrutura é medido pelo cluster e pelo billing.
insert into public.ai_pricing
  (model, prompt_cents_per_million_tokens, completion_cents_per_million_tokens,
   embedding_cents_per_million_tokens, notes)
values
  ('platform-chat', 0, 0, null, 'IA gerenciada pelo SaaS Whatsapp'),
  ('platform-fast', 0, 0, null, 'IA rápida gerenciada pelo SaaS Whatsapp'),
  ('platform-embedding', null, null, 0, 'Embedding gerenciado pelo SaaS Whatsapp')
on conflict (model) do update set
  prompt_cents_per_million_tokens = excluded.prompt_cents_per_million_tokens,
  completion_cents_per_million_tokens = excluded.completion_cents_per_million_tokens,
  embedding_cents_per_million_tokens = excluded.embedding_cents_per_million_tokens,
  notes = excluded.notes,
  superseded_at = null;

-- Organização nova nasce no provider gerenciado.
create or replace function public.fn_seed_org_llm_defaults() returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if coalesce(new.settings->'llm'->>'default_model', '') = '' then
    new.settings := jsonb_set(
      coalesce(new.settings, '{}'::jsonb),
      '{llm}',
      coalesce(new.settings->'llm', '{}'::jsonb)
        || jsonb_build_object(
             'provider', 'saas_ai',
             'default_model', coalesce(
               (select m.model_id from public.ai_models m
                where m.provider = 'saas_ai'
                  and m.is_default_for_provider
                  and m.deprecated_at is null
                limit 1),
               'platform-chat'
             )
           ),
      true
    );
  end if;
  return new;
end;
$$;

-- Backfill conservador: só corrige organizações sem escolha explícita de provider
-- ou modelo. Configuração legada deliberada continua válida para migração gradual.
update public.organizations o
set settings = jsonb_set(
      coalesce(o.settings, '{}'::jsonb),
      '{llm}',
      coalesce(o.settings->'llm', '{}'::jsonb)
        || jsonb_build_object('provider', 'saas_ai', 'default_model', 'platform-chat'),
      true
    )
where coalesce(o.settings->'llm'->>'provider', '') = ''
   or coalesce(o.settings->'llm'->>'default_model', '') = '';
