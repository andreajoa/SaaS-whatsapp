---
trigger: always_on
description: Guias do assistente do Atenza — quando usar cada um
---

Este repositório embute guias (skills em `.agents/skills/`) para cinco situações. Quando o pedido
casar, carregue o guia antes de agir — a pessoa pode não saber que ele existe:

- instalar, subir, atualizar, consertar a instalação numa VPS, domínio, Supabase, WhatsApp
  que não conecta → `atenza-instalar`
- configurar o CRM para um cliente ou nicho (clínica, imobiliária, serviços, curso, loja):
  agentes, roteadores, follow-ups, base de conhecimento → `atenza-cliente-novo`
- desempenho, conversão, custo de IA, funil, relatório, "o agente está vendendo?" → `atenza-metricas`
- o agente responde errado, passa tudo para humano, não usa a agenda, melhorar o prompt → `atenza-prompt`
- contribuir, corrigir um bug, abrir ou atualizar um PR, migration, conflito com a main → `atenza-contribuir`
  (rode `bash .agents/skills/atenza-contribuir/scripts/quem-sou.sh` primeiro: se disser
  `mantenedor`, este guia fica quieto)

Escrevendo código aqui: `atenza-doutrina` (as regras que mais custam) e `sistema-vivo` (o gate
de arquitetura). A doutrina completa é o `CLAUDE.md` da raiz; o contrato portável é o `AGENTS.md`.
