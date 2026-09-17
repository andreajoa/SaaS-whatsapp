# SaaS Whatsapp — checklist de produção

## Aplicação
- [ ] Vercel conectada a `main`.
- [ ] domínio no Cloudflare com TLS e WAF.
- [ ] Supabase de produção com migrations aplicadas.
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, anon key, service role e `SUPABASE_DB_URL` configurados.
- [ ] Resend e domínio de envio validados.

## IA
- [ ] `SAAS_AI_BASE_URL` acessível da aplicação e dos workers.
- [ ] aliases `platform-chat` e `platform-fast` aceitam tool calling.
- [ ] `platform-embedding` devolve exatamente 1536 dimensões.
- [ ] `platform-transcribe` responde no contrato OpenAI-compatible de transcrição.
- [ ] endpoint protegido por rede privada e/ou `SAAS_AI_API_KEY`.
- [ ] autoscaling/réplicas e backpressure testados sob carga.

## WhatsApp
- [ ] Meta App/WABA/webhook configurado para o caminho oficial.
- [ ] WAHA habilitado apenas se a oferta comercial exigir conexão QR.
- [ ] webhook idempotente e rate-limitado.
- [ ] worker fora da Vercel, executando continuamente e escalável horizontalmente.

## Segurança/isolamento
- [ ] teste RLS com duas organizações prova leitura/escrita cruzada bloqueada.
- [ ] service-role sempre acompanhado de filtro programático por `organization_id`.
- [ ] logs sem chave, token, conteúdo sensível ou PII desnecessária.
- [ ] backup/restore de Postgres e Storage ensaiado.

## Carga
- [ ] simular 1.000 sessões web concorrentes.
- [ ] simular rajadas de webhooks por múltiplos números.
- [ ] medir p95/p99 de webhook → fila → IA → envio.
- [ ] confirmar que saturação da IA aumenta fila sem perder/duplicar mensagem.
