# Runtime Oracle + front na Vercel

Esta topologia mantém o Next.js no Vercel e move os processos Docker persistentes
para uma VM Oracle Cloud.

## Serviços na Oracle

- WAHA + volumes `waha-data` e `waha-media`
- agent-worker
- Redis
- serverless-redis-http (SRH)
- scheduler
- Caddy para HTTPS do WAHA e do SRH

Não existe serviço `app` neste compose. O scheduler usa `NEXT_PUBLIC_APP_URL`
para chamar as rotas cron hospedadas no Vercel.

## VM

A opção preferida é Oracle Ampere A1 ARM64. O WAHA tem imagem ARM específica e
worker/scheduler deste repositório são publicados em amd64 e arm64.

## DNS

Crie dois registros A apontando para o IP público da VM:

- `WAHA_DOMAIN`
- `REDIS_DOMAIN`

Abra TCP 80 e 443 no Security List/NSG da OCI e no firewall do sistema.

## Subida

```bash
git clone https://github.com/andreajoa/SaaS-whatsapp.git
cd SaaS-whatsapp
cp .env.oracle.example .env.oracle
# preencher .env.oracle
bash oracle-setup/install.sh
```

## Vercel

Depois que os dois domínios estiverem com HTTPS válido, configure no projeto da
Vercel:

```
WAHA_API_BASE_URL=https://<WAHA_DOMAIN>
WAHA_API_KEY=<plaintext da mesma chave usada na Oracle>
WAHA_HMAC_SECRET=<mesmo valor da Oracle>
UPSTASH_REDIS_REST_URL=https://<REDIS_DOMAIN>
UPSTASH_REDIS_REST_TOKEN=<mesmo SRH_TOKEN da Oracle>
INTERNAL_SECRET=<mesmo valor da Oracle>
```

O webhook do WAHA aponta de volta para o app hospedado na Vercel por
`WAHA_WEBHOOK_BASE_URL`.

## Persistência

As sessões e mídias do WAHA ficam em volumes Docker na Oracle. Backup do volume
`waha-data` é obrigatório antes de recriar ou migrar a VM.
