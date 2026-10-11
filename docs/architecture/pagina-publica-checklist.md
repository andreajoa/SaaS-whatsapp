# Living System Checklist — página pública e mídia

1. **Entrada:** visitante anônimo em `app/page.tsx`; `visitanteAtual`,
   `marcaDaSaida` e catálogo de planos existentes resolvem conteúdo e oferta.
2. **Saída:** CTAs abrem `/signup` ou a seção `planos`; os formulários
   `CapturaDeLead` e `ConviteDeLead` mantêm o opt-in existente.
3. **Registro:** `Medidor` mantém visitas, marco do preço e cliques canônicos
   em `/api/v1/site/visita` e `/api/v1/site/pulso`. A reprodução da mídia não
   cria mutação de produto nem envia mensagens a clientes.
4. **Tela:** raiz pública com demonstração identificada, exemplos, integrações,
   preços e mídia. A captação confirma resultado ou mostra erro no formulário.
5. **Porta:** URL raiz, navegação por âncoras e CTA de vídeo na abertura.
   Os três arquivos públicos de vídeo e legenda têm lista fechada em
   `lib/auth/public-paths.ts`, com regressão que preserva a proteção de mídia
   privada. Não foi criada rota pública adicional.
6. **Anti-morte:** nenhum, justificado por conteúdo de leitura. O visitante
   escolhe assistir, conhecer os planos, cadastrar-se ou entrar em contato.
   Falha de mídia preserva pôster, transcrição e CTAs.
7. **Configuração:** conteúdo e arquivos versionados; marca e preços continuam
   nos resolvedores existentes. Sem cobrança, a raiz redireciona para `/app`.
8. **Continuidade:** a demonstração explica IA e equipe humana; não executa
   atendimento, publicação de agente ou ações comerciais.
9. **Retorno:** erro de mídia permite usar transcrição; erros da captação
   continuam orientando nova tentativa. Métricas do funil existente permitem
   revisar a página. Não há decisão automática nova a aprender ou corrigir.
10. **Mapa:** `pagina-publica.architecture.json` declara entradas, mídia,
    cadastro e captação, com as arestas dos registros existentes.

## Limites do conteúdo

Pessoas e exemplos são contextuais. Dados da demonstração são fictícios.
Não há declaração de clientes, resultados ou certificações sem comprovação.
Integrações dependem da configuração e autorização do respectivo serviço.
O vídeo narrado usa voz sintética em português; não representa uma pessoa
da equipe ou depoimento. A oferta usa o catálogo, sem nova regra comercial.
