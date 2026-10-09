# Integrações de comércio — pesquisa em 08/10/2026

Escopo: instalação independente, tokens/refresh, webhooks, consultas e permissões de Shopify/WooCommerce, encaixe no baseline/runtime e segurança de automações. Pesquisa documental; sem acesso a contas, segredos, alteração de código ou execução de testes. Fatos oficiais, leitura local e propostas estão identificados separadamente.

**Ressalva temporal:** páginas oficiais são mutáveis; este documento registra o conteúdo consultado em 08/10/2026, sem garantir uma reprodução histórica integral. Os anúncios Shopify abaixo têm datas explícitas; a análise do código WooCommerce usa o commit oficial `4ed122dbd46d7c3fbe069cf1797391f7d4c7e049`, de 08/10/2026, que representa desenvolvimento, não necessariamente a versão instalada em cada loja. [Anúncio de março](https://shopify.dev/changelog/posts/expiring-offline-access-tokens-required-for-public-apps-april-1-2026), [anúncio de maio](https://shopify.dev/changelog/posts/expiring-offline-access-tokens-required-for-all-public-apps-as-of-january-1-2027), [commit WooCommerce](https://github.com/woocommerce/woocommerce/commit/4ed122dbd46d7c3fbe069cf1797391f7d4c7e049).

## Shopify: instalação e autorização

**Documentado:** apps independentes e somente de API usam authorization code grant: redirecionam o lojista, recebem autorização e trocam o código no servidor. Client credentials atende lojas da própria organização Shopify; não substitui o consentimento dos clientes externos do SaaS. [Autenticação independente](https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps).

**Documentado:** distribuição pública atende várias lojas e exige aprovação na Shopify App Store. Distribuição personalizada limita a instalação a uma loja ou lojas da mesma organização Plus. A escolha de distribuição não pode ser alterada depois; o método de autenticação não amplia essas permissões de distribuição. [Distribuição](https://shopify.dev/docs/apps/launch/distribution), [seleção](https://shopify.dev/docs/apps/launch/distribution/select-distribution-method).

**Documentado:** cadastre previamente o `redirect_uri`; ele deve coincidir exatamente. Gere `state` aleatório por tentativa e confira o valor devolvido. Valide `shop` com `^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$` antes de construir URLs e novamente no retorno. [Fluxo e validações](https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps).

**Recomendação:** vincular o estado persistido ao tenant autenticado, à loja esperada e a uma única tentativa consumível. O callback assinado identifica a autorização Shopify; esse vínculo resolve a instalação correspondente no SaaS. Base: [validação de estado](https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps#verify-the-state-parameter).

**Documentado:** `scope` contém permissões separadas por vírgula. Offline é o modo padrão; `grant_options[]=per-user` solicita online. Para o HMAC do callback, retire somente `hmac`, ordene todos os demais parâmetros e serialize como pares `chave=valor` unidos por `&`; calcule HMAC-SHA256 com o segredo do app, em **hexadecimal**, comparando em tempo constante. [Callback](https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps#verify-the-hmac), [tokens](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens).

Modelo da autorização e do retorno; placeholders devem ser codificados para URL. Parâmetros adicionais recebidos também participam do HMAC. [Contrato oficial](https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps).

```text
GET https://<LOJA>.myshopify.com/admin/oauth/authorize?client_id=<CLIENT_ID>&scope=<ESCOPOS_CODIFICADOS>&redirect_uri=<URI_CODIFICADO>&state=<NONCE>
GET https://<HOST_SAAS>/<CALLBACK>?code=<CODIGO>&hmac=<HMAC_HEX>&shop=<LOJA>.myshopify.com&state=<NONCE>&timestamp=<TIMESTAMP>
```

**Documentado:** `read_products`, `read_orders` e `read_customers` são permissões distintas. Pedidos abrangem os últimos 60 dias por padrão; histórico completo requer aprovação de `read_all_orders`, além de `read_orders` ou `write_orders`. [Escopos](https://shopify.dev/docs/api/usage/access-scopes).

**Documentado:** permissão OAuth não equivale à aprovação de dados protegidos. Nome, endereço, telefone e e-mail têm requisitos específicos; dados de clientes e pedidos em webhooks também entram nessa classificação. [Dados protegidos](https://shopify.dev/docs/apps/launch/protected-customer-data).

**Documentado:** `embedded=false` configura o app independente. Com `use_legacy_install_flow` ausente ou falso, Shopify gerencia a instalação e solicita os escopos configurados. **Recomendação:** manter coerência entre o modo de instalação escolhido, os escopos configurados e a URL OAuth. [Configuração do app](https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration#access_scopes).

## Shopify: tokens com expiração e migração

**Documentado:** desde **01/04/2026**, novos apps públicos devem solicitar e usar tokens offline com expiração. O anúncio de **20/05/2026** estendeu a obrigação aos apps públicos existentes, com prazo em **01/01/2027**. Apps personalizados e criados por lojistas estão excluídos. O guia atual detalha a rejeição em chamadas GraphQL Admin; não extrapolar esse detalhe de enforcement para todas as outras APIs. [Novos apps](https://shopify.dev/changelog/posts/expiring-offline-access-tokens-required-for-public-apps-april-1-2026), [todos os públicos](https://shopify.dev/changelog/posts/expiring-offline-access-tokens-required-for-all-public-apps-as-of-january-1-2027), [migração](https://shopify.dev/docs/apps/build/authentication-authorization/migrate-to-expiring-offline-access-tokens).

Troca inicial offline: `expiring=1` pertence ao POST que troca o código, não ao grant de refresh. Omiti-lo solicita, por padrão, token sem expiração. Corpo com valores codificados como formulário. [Parâmetros da troca](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens#authorization-code-grant).

```http
POST /admin/oauth/access_token HTTP/1.1
Host: <LOJA>.myshopify.com
Content-Type: application/x-www-form-urlencoded

client_id=<CLIENT_ID>&client_secret=<SEGREDO_APP>&code=<CODIGO_AUTORIZACAO>&expiring=1
```

Resposta: `access_token`, `refresh_token` e `scope` são strings; as duas durações são inteiros em segundos. Atualmente: acesso de 1 hora e refresh inicialmente de 90 dias; persistir as durações devolvidas, sem fixá-las no código. Template abaixo contém placeholders e precisa de substituição para ser JSON válido. [Resposta e duração](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens#token-lifetimes), [exemplo da resposta](https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps).

```text
{
  "access_token": "<TOKEN_ACESSO>",
  "expires_in": <INTEIRO_SEGUNDOS>,
  "refresh_token": "<TOKEN_REFRESH>",
  "refresh_token_expires_in": <INTEIRO_SEGUNDOS>,
  "scope": "<ESCOPOS_CONCEDIDOS>"
}
```

**Payload exato do refresh:** mesmos endpoint e formato; quatro campos, `grant_type=refresh_token`, sem código, `subject_token` ou `expiring`. Cada resposta fornece novo par de tokens e durações. [Contrato do refresh](https://shopify.dev/docs/apps/build/authentication-authorization/implement-token-exchange#send-the-refresh-request).

```http
POST /admin/oauth/access_token HTTP/1.1
Host: <LOJA>.myshopify.com
Content-Type: application/x-www-form-urlencoded

client_id=<CLIENT_ID>&client_secret=<SEGREDO_APP>&grant_type=refresh_token&refresh_token=<TOKEN_REFRESH_ATUAL>
```

**Documentado:** o refresh anterior permanece utilizável até usar o novo, adquirir outro token por OAuth/token exchange, atingir 30 dias desde seu primeiro uso ou a expiração original de 90 dias, o que vier primeiro. O acesso anterior continua válido até sua própria expiração. [Rotação](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens#how-refresh-token-rotation-works).

**Documentado:** não executar aquisição e refresh simultâneos na mesma loja; aquisição aposenta os demais refresh tokens. Workers concorrentes também podem substituir as credenciais uns dos outros. Timeout, erro de rede, `5xx` transitório e `429` permitem repetir com o refresh ainda armazenado; `401` com `error=invalid_request` é terminal e requer nova autorização, sem inferir se houve expiração, revogação ou desinstalação. [Concorrência](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens#token-refresh), [falhas de refresh](https://shopify.dev/docs/apps/build/authentication-authorization/implement-token-exchange#refresh-an-expiring-offline-token).

**Recomendação:** serializar aquisição/refresh por instalação, reler credenciais depois de obter a exclusividade e persistir o novo par com as duas expirações atomicamente. Não liberar workers com apenas metade da resposta gravada. Base: [regras de rotação](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens#how-refresh-token-rotation-works).

Migração sem sessão usa o token offline antigo ativo, credenciais do app e os campos abaixo. Invalida permanentemente o token antigo para GraphQL Admin; tokens online, delegados, restritos ou já expirantes não são elegíveis. [Migração direta](https://shopify.dev/docs/apps/build/authentication-authorization/migrate-to-expiring-offline-access-tokens#migrate-existing-tokens-without-a-user-session).

```http
POST /admin/oauth/access_token HTTP/1.1
Host: <LOJA>.myshopify.com
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:token-exchange&client_id=<CLIENT_ID>&client_secret=<SEGREDO_APP>&subject_token=<TOKEN_OFFLINE_ANTIGO>&subject_token_type=urn:shopify:params:oauth:token-type:offline-access-token&requested_token_type=urn:shopify:params:oauth:token-type:offline-access-token&expiring=1
```

**Documentado:** desde o anúncio de **29/09/2026**, uma resposta de migração perdida pode ser recuperada repetindo a requisição original elegível por até sete dias; retorna o mesmo par e pode estender apenas a expiração do acesso. Recuperação termina após refresh do par ou aquisição posterior que o aposente. Rejeição de token não expirante em GraphQL retorna `403`; verificar a mensagem de migração, pois falta de escopo também pode retornar `403`. [Anúncio de recuperação](https://shopify.dev/changelog/posts/more-resilient-token-exchanges-when-migrating-tokens-without-a-user-session), [erros da migração](https://shopify.dev/docs/apps/build/authentication-authorization/migrate-to-expiring-offline-access-tokens#handle-errors-during-the-transition).

## Shopify: webhooks HTTPS, desinstalação e privacidade

**Documentado:** validar `X-Shopify-Hmac-SHA256` com HMAC-SHA256 sobre os **bytes originais do corpo**, usando o segredo do app; digest em **base64**. Capturar antes de interpretar JSON; serializar o objeto novamente altera a mensagem assinada. Isso é diferente do HMAC hexadecimal do OAuth. [Verificação HTTPS](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries#hmac-verification).

**Documentado:** `X-Shopify-Webhook-Id` identifica a entrega e serve à deduplicação. `X-Shopify-Event-Id` é compartilhado por entregas decorrentes da mesma ação; assinaturas distintas podem produzir diferentes webhook IDs para o mesmo evento. `X-Shopify-Shop-Domain`, `X-Shopify-Topic` e `X-Shopify-Triggered-At` informam loja, tópico e horário. [Headers](https://shopify.dev/docs/api/webhooks/latest#headers), [distinção entre IDs](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries#ignoring-duplicates).

**Recomendação:** deduplicar entregas por instalação + webhook ID. Usar event ID para correlação; deduplicação de efeito entre assinaturas deve incluir o tipo do efeito, evitando descartar processamentos diferentes da mesma ação. Base: [semântica dos IDs](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries#ignoring-duplicates).

**Documentado:** Shopify verifica TLS, espera conexão em até 1 segundo e conclusão em até 5 segundos. Responder `200` rapidamente; respostas fora de `2xx`, inclusive redirecionamentos, são erros. Há oito novas tentativas ao longo de quatro horas; após falhas consecutivas a assinatura criada pela Admin API pode ser excluída. [Entrega e retries](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries#https-delivery-considerations).

**Recomendação:** confirmar recebimento após persistência durável; processar em fila e reconciliar dados perdidos. Assinatura removida precisa ser recriada; recuperação de entrega e recuperação de dados são tarefas distintas. Base: [troubleshooting](https://shopify.dev/docs/apps/build/webhooks/troubleshoot).

**Proposta de tópicos operacionais:** `products/create`, `products/update`, `products/delete`; `inventory_levels/update`; `orders/create`, `orders/updated`, `orders/paid`, `orders/cancelled`; `customers/update`, `customers/delete`. Assinar apenas funções habilitadas e scopes aprovados. Configuração TOML aplica assinaturas a todas as lojas instaladas; assinaturas via GraphQL são específicas da loja. [Tópicos e instalação das assinaturas](https://shopify.dev/docs/api/webhooks/2026-10).

**Segurança proposta:** o HMAC autentica o corpo; não assumir que autentica headers de roteamento/IDs. Resolver a conexão por rota configurada e mapeamento persistido de instalação, conferir loja quando presente no payload e manter deduplicação/efeitos dentro desse tenant. Reconsultar recursos com a credencial dessa conexão antes de efeitos sensíveis. Receivers de uninstall/privacidade devem autenticar HMAC e funcionar mesmo sem access token utilizável. [Bytes assinados](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries#hmac-verification).

**Documentado:** `app/uninstalled` informa desinstalação; tokens são revogados. `shop/redact` chega 48 horas depois para apagar dados da loja. São eventos com finalidades distintas. **Recomendação:** interromper sincronização e invalidar credenciais locais no primeiro, preservando capacidade de atender o segundo sem depender da API da loja. [Tópicos](https://shopify.dev/docs/api/webhooks/latest), [revogação](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens#refresh-rotation-and-revocation), [redação da loja](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance#shop-redact).

**Documentado:** apps distribuídos pela App Store devem assinar `customers/data_request`, `customers/redact` e `shop/redact`, mesmo sem coletar dados pessoais. Exigem POST JSON; HMAC inválido deve receber `401`; confirmar com `2xx` e concluir em até 30 dias, respeitada a exceção documental de retenção legal. [Compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance).

Fragmento de configuração com versão fixa. [Assinaturas de compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance#subscribe-to-compliance-webhooks), [versionamento](https://shopify.dev/docs/api/usage/versioning).

```toml
[webhooks]
api_version = "2026-10"

[[webhooks.subscriptions]]
topics = ["app/uninstalled"]
uri = "https://<HOST_SAAS>/<ROTA_DESINSTALACAO>"

[[webhooks.subscriptions]]
compliance_topics = ["customers/data_request", "customers/redact", "shop/redact"]
uri = "https://<HOST_SAAS>/<ROTA_PRIVACIDADE>"
```

Templates dos corpos de privacidade; IDs e elementos das listas são numéricos, domínio/e-mail/telefone são strings. Disponibilidade dos identificadores do cliente pode variar. Substituir placeholders antes de usar. [Payloads oficiais](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance).

```text
customers/data_request:
{"shop_id":<ID_LOJA>,"shop_domain":"<LOJA>.myshopify.com","orders_requested":[<ID_PEDIDO>],"customer":{"id":<ID_CLIENTE>,"email":"<EMAIL>","phone":"<TELEFONE>"},"data_request":{"id":<ID_SOLICITACAO>}}
customers/redact:
{"shop_id":<ID_LOJA>,"shop_domain":"<LOJA>.myshopify.com","customer":{"id":<ID_CLIENTE>,"email":"<EMAIL>","phone":"<TELEFONE>"},"orders_to_redact":[<ID_PEDIDO>]}
shop/redact:
{"shop_id":<ID_LOJA>,"shop_domain":"<LOJA>.myshopify.com"}
```

## WooCommerce: leitura autenticada e criação de webhooks

**Documentado:** criar chave em WooCommerce → configurações → avançado → REST API, associada a um usuário e com acesso `Read`. Sobre HTTPS, autenticar com HTTP Basic: consumer key como usuário, consumer secret como senha. Permissões do usuário associado também limitam acesso. A Store API não substitui a REST API autenticada para dados administrativos. [Autenticação](https://developer.woocommerce.com/docs/apis/rest-api/authentication/), [limites da Store API](https://developer.woocommerce.com/docs/apis/store-api/).

Exemplo de leitura, sem credenciais na URL; o header contém base64 do par separado por dois-pontos. [Basic HTTPS](https://developer.woocommerce.com/docs/apis/rest-api/authentication/#authentication-over-https).

```http
GET /wp-json/wc/v3/orders?page=<PAGINA>&per_page=<LIMITE> HTTP/1.1
Host: <HOST_LOJA>
Authorization: Basic <BASE64_CONSUMER_KEY_DOIS_PONTOS_CONSUMER_SECRET>
Accept: application/json
```

**Documentado no código oficial:** chave `read` permite GET/HEAD, mas POST/PUT/PATCH/DELETE exigem `write` ou `read_write`. Criar webhook usa POST `/wp-json/wc/v3/webhooks`; portanto, **uma chave somente de leitura não pode criá-lo**. **Recomendação:** manter a chave de leitura no SaaS e solicitar criação manual pelo administrador, com segredo de webhook explícito e independente. [Verificação de permissões](https://github.com/woocommerce/woocommerce/blob/4ed122dbd46d7c3fbe069cf1797391f7d4c7e049/plugins/woocommerce/includes/class-wc-rest-authentication.php#L754), [criação REST](https://developer.woocommerce.com/docs/apis/rest-api/v3/webhooks/#create-a-webhook), [criação manual](https://woocommerce.com/document/webhooks/).

Contrato para eventual criação com credencial de escrita autorizada, ou como especificação dos campos a configurar manualmente; não executar com a chave `read`. [Campos do webhook](https://developer.woocommerce.com/docs/apis/rest-api/v3/webhooks/).

```http
POST /wp-json/wc/v3/webhooks HTTP/1.1
Host: <HOST_LOJA>
Authorization: Basic <BASE64_CREDENCIAL_COM_ESCRITA>
Content-Type: application/json

{"name":"<NOME>","status":"active","topic":"order.updated","delivery_url":"https://<HOST_SAAS>/<ROTA_WEBHOOK>","secret":"<SEGREDO_WEBHOOK>"}
```

**Documentado:** tópicos incluem `order.created/updated/deleted`, `product.created/updated/deleted` e equivalentes de clientes/cupons. A entrega traz `X-WC-Webhook-Signature` em base64, HMAC-SHA256 do corpo com o segredo do webhook; verificar sobre bytes originais, antes de JSON. `X-WC-Webhook-ID` identifica a assinatura; `X-WC-Webhook-Delivery-ID` identifica a entrega. [REST e headers](https://developer.woocommerce.com/docs/apis/rest-api/v3/webhooks/#deliverypayload).

**Ressalva documentada:** a referência REST descreve delivery ID como ID numérico de comentário; o código consultado gera um hash por webhook e tempo em segundos. Tratar como string opaca, sem pressupor unicidade perfeita ou estabilidade entre reenvios. **Recomendação:** deduplicar entrega por instalação + assinatura + delivery ID e tornar o efeito idempotente por recurso/estado, sem usar apenas ID do pedido para descartar atualizações legítimas. [Implementação do ID](https://github.com/woocommerce/woocommerce/blob/4ed122dbd46d7c3fbe069cf1797391f7d4c7e049/plugins/woocommerce/includes/class-wc-webhook.php#L496), [referência](https://developer.woocommerce.com/docs/apis/rest-api/v3/webhooks/#deliverypayload).

**Ressalva documentada:** o guia comercial informa desativação após mais de cinco falhas consecutivas e sucesso em `2xx`, `301` ou `302`; outras páginas dizem cinco retries/falhas. O código compara o contador anterior com `> 5` e aceita códigos de 200 até 302. Esses detalhes variam por versão/filtros; não prometer desativação exatamente na quinta ou sexta tentativa. [Guia comercial](https://woocommerce.com/document/webhooks/#automatic-disabling), [guia de desenvolvimento](https://developer.woocommerce.com/docs/best-practices/urls-and-routing/webhooks/), [contador e resposta](https://github.com/woocommerce/woocommerce/blob/4ed122dbd46d7c3fbe069cf1797391f7d4c7e049/plugins/woocommerce/includes/class-wc-webhook.php#L574).

**Documentado no código:** timeout padrão de entrega é 60 segundos, modificável por filtros. O contador de falhas, sozinho, não comprova reenvio automático do mesmo evento nem janela garantida de recuperação; agendamento e entrega dependem da instalação. **Recomendação:** responder `2xx` rapidamente após persistência, monitorar webhook desativado e reconciliar via REST de leitura. [HTTP e timeout](https://github.com/woocommerce/woocommerce/blob/4ed122dbd46d7c3fbe069cf1797391f7d4c7e049/plugins/woocommerce/includes/class-wc-webhook.php#L333), [fila de entrega](https://github.com/woocommerce/woocommerce/blob/4ed122dbd46d7c3fbe069cf1797391f7d4c7e049/plugins/woocommerce/includes/wc-webhook-functions.php), [gestão e logs](https://woocommerce.com/document/webhooks/).

**Documentado:** ativação inicial envia um ping à URL; tratá-lo como verificação de conectividade, sem presumir payload de pedido/produto. O segredo omitido tem defaults diferentes descritos pelas páginas oficiais; defini-lo explicitamente evita depender dessa divergência. [Ping e segredo no painel](https://woocommerce.com/document/webhooks/), [schema REST](https://developer.woocommerce.com/docs/apis/rest-api/v3/webhooks/).

## REST WooCommerce: consultas para o adapter de leitura

Com o header Basic anterior, requests exatos sugeridos:

| Dado | GET |
|---|---|
| Produtos | `/wp-json/wc/v3/products?status=publish&page=1&per_page=50` |
| Variações de produto variável | `/wp-json/wc/v3/products/{product_id}/variations?page=1&per_page=50` |
| Pedidos | `/wp-json/wc/v3/orders?page=1&per_page=50` |
| Um pedido | `/wp-json/wc/v3/orders/{order_id}` |
| Clientes registrados | `/wp-json/wc/v3/customers?page=1&per_page=50` |

Campos de produto/variação: `id`, `sku`, `price/regular_price/sale_price` (strings decimais), `manage_stock`, `stock_quantity` (nullable), `stock_status`, `backorders`, `attributes`. Produto pai variável não substitui leitura de suas variações; estoque pode ser herdado. Pedido contém `currency`, `total`, `line_items`, `billing`, `shipping`; `customer_id=0` pode ser compra de visitante. A moeda de produto não deve ser inferida como BRL. [Produtos](https://developer.woocommerce.com/docs/apis/rest-api/v3/products/), [variações](https://developer.woocommerce.com/docs/apis/rest-api/v3/product-variations/), [pedidos](https://developer.woocommerce.com/docs/apis/rest-api/v3/orders/), [clientes](https://developer.woocommerce.com/docs/apis/rest-api/v3/customers/).

Paginar por `X-WP-TotalPages`/`X-WP-Total`; REST WordPress limita `per_page` a 100. Para incremental de produtos, a referência oferece `modified_after` + `dates_are_gmt=true`; não aplicar automaticamente o mesmo filtro a clientes, cuja lista documenta parâmetros distintos. Detectar credencial revogada via 401/403; não existe refresh OAuth para esse par de API keys. [Paginação](https://developer.wordpress.org/rest-api/using-the-rest-api/pagination/), [filtros de produtos](https://developer.woocommerce.com/docs/apis/rest-api/v3/products/#list-all-products), [filtros de clientes](https://developer.woocommerce.com/docs/apis/rest-api/v3/customers/#list-all-customers), [chaves](https://developer.woocommerce.com/docs/apis/rest-api/authentication/).

## Admin GraphQL Shopify: versão, permissões e consultas exatas

**CONFIRMADO na documentação em 2026-10-08:** `2026-10` é a versão estável mais recente; fixar `POST https://{shop}.myshopify.com/admin/api/2026-10/graphql.json`, `Content-Type: application/json`, `X-Shopify-Access-Token: {access_token}`, body `{"query":"<uma operação abaixo>","variables":{...}}`. Conferir `X-Shopify-API-Version`; divergência indica fallback de versão. OAuth é não versionado. As referências `2026-10` consultadas redirecionam para `latest` com seletor explícito `2026-10`; revalidar ao atualizar. [Versionamento](https://shopify.dev/docs/api/usage/versioning), [endpoint/exemplo oficial](https://shopify.dev/docs/api/admin-graphql/2026-10/queries/productVariants).

| Necessidade | Escopo mínimo proposto |
|---|---|
| Produto, variantes, preço base/contextual | `read_products` |
| Estoque por local | `read_inventory`; `read_locations` para consultar locais |
| Pedidos recentes | `read_orders` |
| Clientes | `read_customers` |
| Pedidos anteriores a 60 dias | `read_all_orders` aprovado + `read_orders` |

A lista acima é uma **proposta de acesso somente leitura**, a habilitar por funcionalidade; não pedir `write_*`. `read_all_orders` requer autorização específica da Shopify. [Escopos e pedidos](https://shopify.dev/docs/api/usage/access-scopes), [InventoryLevel](https://shopify.dev/docs/api/admin-graphql/2026-10/objects/InventoryLevel).

**Dados protegidos:** pedidos vinculados a clientes já exigem considerar nível 1; nome, endereço, telefone e e-mail são nível 2. Apps públicos precisam de revisão e aprovação dos recursos/campos, além dos scopes e consentimento do lojista. Custom app tem regras diferentes; não extrapolar a aprovação de uma development store. Consultas podem retornar HTTP 200 + `errors` e campos redigidos: tratar acesso negado separadamente de valor ausente. PII deve ficar fora do contexto do agente quando não necessária. [Requisitos e matriz por distribuição](https://shopify.dev/docs/apps/launch/protected-customer-data).

As operações seguintes foram **conferidas nas referências**, não executadas numa loja nem validadas por introspecção autenticada. Todos os IDs/valores de variáveis são exemplos sintéticos. Rodar separadamente para não misturar falhas de permissões.

### Identidade da loja e escopos concedidos

```graphql
query IntegrationIdentity {
  shop { id myshopifyDomain currencyCode }
  currentAppInstallation { accessScopes { handle } }
}
```

Guardar o ID da loja e conferir scopes efetivamente concedidos antes de habilitar tools. [Shop](https://shopify.dev/docs/api/admin-graphql/2026-10/objects/Shop), [currentAppInstallation](https://shopify.dev/docs/api/admin-graphql/2026-10/queries/currentAppInstallation).

### Produtos, variantes e preços

```graphql
query CatalogPage($first: Int!, $after: String, $filter: String, $country: CountryCode!) {
  productVariants(first: $first, after: $after, query: $filter) {
    nodes {
      id title sku updatedAt price compareAtPrice inventoryPolicy inventoryQuantity
      selectedOptions { name value }
      product { id title handle status onlineStoreUrl }
      inventoryItem { id tracked }
      contextualPricing(context: {country: $country}) {
        price { amount currencyCode }
        compareAtPrice { amount currencyCode }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

Variáveis: `{"first":50,"after":null,"filter":"product_status:ACTIVE","country":"BR"}`. Para um produto usar `product_id:123456789`; para SKU, `sku:ABC-123`, escapando caracteres pela sintaxe oficial. Paginar variantes na raiz evita truncar produtos com muitas variantes; checar visibilidade/publicação antes de oferecê-las. `price`/`compareAtPrice` são escalares decimais na moeda da loja, **não** objetos MoneyV2; preço contextual tem `amount/currencyCode` e considera Markets ativos. Não assumir que preço base seja o total de checkout. [Consulta e filtros](https://shopify.dev/docs/api/admin-graphql/2026-10/queries/productVariants), [tipos da variante](https://shopify.dev/docs/api/admin-graphql/2026-10/objects/ProductVariant), [preço contextual](https://shopify.dev/docs/api/admin-graphql/2026-10/objects/ProductVariantContextualPricing), [contexto](https://shopify.dev/docs/api/admin-graphql/2026-10/input-objects/ContextualPricingContext), [sintaxe](https://shopify.dev/docs/api/usage/search-syntax).

### Estoque por variante e local, com paginação independente

```graphql
query InventoryPage($id: ID!, $first: Int!, $after: String) {
  inventoryItem(id: $id) {
    id tracked
    inventoryLevels(first: $first, after: $after) {
      nodes {
        id updatedAt
        location { id name }
        quantities(names: ["available", "on_hand", "committed"]) { name quantity }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}
```

Variáveis: `{"id":"gid://shopify/InventoryItem/123456789","first":50,"after":null}`. `available` é a quantidade vendável naquele local; `on_hand` e `committed` são estados distintos. `inventoryQuantity` é agregado e não substitui a política de locais; `tracked=false` e `inventoryPolicy=CONTINUE` precisam de tratamento próprio. Webhook de estoque deve invalidar/refazer essa leitura: não presumir que `ProductVariant.updatedAt` cubra toda mudança de inventário. [inventoryItem](https://shopify.dev/docs/api/admin-graphql/2026-10/queries/inventoryItem), [InventoryItem](https://shopify.dev/docs/api/admin-graphql/2026-10/objects/InventoryItem), [InventoryLevel](https://shopify.dev/docs/api/admin-graphql/2026-10/objects/InventoryLevel).

### Pedidos e itens

```graphql
query OrdersPage($first: Int!, $after: String, $filter: String) {
  orders(first: $first, after: $after, query: $filter, sortKey: UPDATED_AT) {
    nodes {
      id name createdAt updatedAt cancelledAt
      displayFinancialStatus displayFulfillmentStatus
      currentTotalPriceSet {
        shopMoney { amount currencyCode }
        presentmentMoney { amount currencyCode }
      }
      customer { id }
      lineItems(first: 50) {
        nodes {
          id title sku quantity currentQuantity
          variant { id }
          originalUnitPriceSet { shopMoney { amount currencyCode } }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

Variáveis: `{"first":25,"after":null,"filter":"updated_at:>='2026-10-01T00:00:00Z'"}`. Se `lineItems.pageInfo.hasNextPage`, executar a operação abaixo por pedido; cursor de itens não é cursor de pedidos. `customer` e `variant` podem ser nulos; preço histórico do item não deve vir do catálogo atual. `quantity` e `currentQuantity` diferem após remoções/reembolsos. [orders](https://shopify.dev/docs/api/admin-graphql/2026-10/queries/orders), [Order](https://shopify.dev/docs/api/admin-graphql/2026-10/objects/Order), [LineItem](https://shopify.dev/docs/api/admin-graphql/2026-10/objects/LineItem).

```graphql
query OrderItemsPage($id: ID!, $after: String) {
  order(id: $id) {
    id
    lineItems(first: 50, after: $after) {
      nodes {
        id title sku quantity currentQuantity variant { id }
        originalUnitPriceSet { shopMoney { amount currencyCode } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}
```

Variáveis: `{"id":"gid://shopify/Order/123456789","after":"<endCursor anterior>"}`. A seleção é o mesmo schema `Order.lineItems` acima. [order](https://shopify.dev/docs/api/admin-graphql/2026-10/queries/order).

### Clientes — seleção condicionada à aprovação

```graphql
query CustomersPage($first: Int!, $after: String, $filter: String) {
  customers(first: $first, after: $after, query: $filter, sortKey: UPDATED_AT) {
    nodes {
      id updatedAt firstName lastName
      defaultEmailAddress { emailAddress }
      defaultPhoneNumber { phoneNumber }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

Variáveis: `{"first":50,"after":null,"filter":"updated_at:>='2026-10-01T00:00:00Z'"}`. `defaultEmailAddress/defaultPhoneNumber` são objetos opcionais; o schema atual documenta esses campos. Remover campos sem aprovação antes de montar a consulta. Não unir contatos entre tenants por e-mail/telefone e não inferir consentimento de marketing da existência do cadastro. [customers](https://shopify.dev/docs/api/admin-graphql/2026-10/queries/customers), [Customer](https://shopify.dev/docs/api/admin-graphql/2026-10/objects/Customer), [e-mail](https://shopify.dev/docs/api/admin-graphql/2026-10/objects/CustomerEmailAddress), [telefone](https://shopify.dev/docs/api/admin-graphql/2026-10/objects/CustomerPhoneNumber).

**Execução proposta:** usar cursores até `hasNextPage=false`; `first` é orçamento escolhido, não limite contratual. Verificar `errors` mesmo com 200 e regular concorrência por app/loja via `extensions.cost.throttleStatus`. Persistir watermark só depois do lote durável; sobrepor uma janela e fazer upsert por ID para eventos atrasados. Reconciliação periódica cobre entregas perdidas; a duração da janela é decisão operacional. [Rate limits GraphQL](https://shopify.dev/docs/apps/build/apis/graphql-admin/rate-limits), [paginação](https://shopify.dev/docs/api/usage/pagination-graphql).

## Encaixe no baseline/runtime local — propostas, sem alteração de código

**CONFIRMADO por leitura local**, HEAD `42886e8`, com possíveis mudanças concorrentes do implementador: [tenant_integrations](../../supabase/baseline.sql#L1807) já possui provider Shopify, tokens cifrados, scopes e `expires_at`; `UNIQUE(organization_id,provider)` admite uma conexão por provider/tenant. Não possui coluna específica de expiração do refresh; WooCommerce ainda exige ampliar os constraints de provider aplicáveis; o constraint efetivo de `webhook_events_log` também não aceita Shopify/WooCommerce. [catalog_products](../../supabase/baseline.sql#L17164) é o catálogo canônico: SKU/código único por organização, dinheiro inteiro + moeda, quantidade não negativa. [runtime](../../lib/ai/runtime/tools.ts#L234) monta tools habilitadas e exclui `apenasHumano`; [engine](../../lib/agent-engine/edge/crm/mcp-tools.ts) reusa a ponte e guarda envio/handoff no harness.

**Decisão informada pelo implementador:** estender `catalog_products` com `external_provider/external_id` e implementar refresh por claim serializado no banco. Contrato mínimo **proposto**, não schema já aplicado:

| Campo/índice | Tipo/regra proposta |
|---|---|
| `catalog_products.external_provider` | `text NULL`; NULL para catálogo manual |
| `catalog_products.external_id` | `text NULL`; GID da variante Shopify ou ID de produto/variação Woo, com namespace para distingui-los |
| Identidade externa | Unique parcial `(organization_id,external_provider,external_id)` quando ambos preenchidos; se houver múltiplas lojas futuramente, incluir conexão/loja |
| `codigo` existente | Manter NOT NULL e unicidade; SKU remoto pode faltar/repetir, então usar código determinístico por provider/ID e preservar SKU remoto como atributo |
| `tenant_integrations.refresh_token_expires_at` | `timestamptz NULL`, calculado da resposta, junto de `expires_at` |
| Claim de refresh | Owner/nonce + lease + geração de credencial; aquisição atômica e publicação condicionada ao mesmo claim/geração |
| Metadados remotos | Loja, product ID, opções, inventory item/locais, política, moeda, `source_updated_at` e `synced_at`; em JSON existente ou estrutura própria definida pelo implementador |

**Refresh concorrente:** adquirir claim antes de ler/decriptar o refresh atual; perdedores aguardam/releem. Um vencedor envia o grant, publica **ambos** tokens e expirações atomicamente e libera claim. Serializar também aquisição no callback, pelo mesmo app + loja: se a loja puder aparecer em mais de um tenant, claim por tenant isoladamente não basta; restringir vínculo ou compartilhar a exclusividade remota. Owner/geração condicionam o commit para impedir worker atrasado ou refresh posterior à desinstalação. Renovar lease durante a chamada se necessário; não usar mutex em memória entre processos. Em timeout/erro de rede/5xx/429, fazer retry limitado sob o claim com o refresh persistido; relê-lo antes de repetir. O refresh apresentado sobrevive até usar o sucessor ou atingir as condições documentadas. Resposta terminal 401 + invalid_request exige reconexão. Claim/lease/geração são desenho local inferido, não garantia transacional ou exatamente uma vez da Shopify. [Refresh oficial](https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps#refresh-the-access-token), [concorrência e rotação](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens#token-refresh).

**Mapeamento:** cada variante vira um item vendável; converter decimal com aritmética decimal para a unidade monetária suportada, sem ponto flutuante e sem presumir duas casas para toda moeda. Preservar valores remotos negativos/ausentes nos metadados e definir explicitamente a projeção para `quantidade>=0`; não confundir ausência de tracking com falta de estoque. A sincronização escreve no espelho local mesmo que as credenciais remotas sejam só de leitura. Separar item importado de edição manual para não sobrescrever silenciosamente preço/estoque. Essas são decisões de implementação pendentes, não comportamento atual.

## Segurança de tools e automações genéricas

**Proposta implementável:** tools de domínio (`commerce_search_products`, `commerce_get_inventory`, `commerce_get_order`), com schema validado e operações remotas fixas. Não expor URL, SQL, GraphQL arbitrário, headers ou credenciais ao modelo. O servidor deriva `organization_id` da sessão/contexto, resolve integração e confirma tenant em toda consulta, cache, fila e execução; ID de pedido não autoriza sua divulgação ao interlocutor. Validar também identidade do cliente antes de mostrar pedido/PII. Permissão de leitura remota não permite envio WhatsApp ou mutação CRM sem política própria. [Autorização OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

Contrato público **proposto** de busca (JSON Schema; contexto/credenciais ficam fora da entrada):

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "query": {"type": "string", "minLength": 1, "maxLength": 200},
    "limit": {"type": "integer", "minimum": 1, "maximum": 20}
  },
  "required": ["query"]
}
```

Tratar descrições, notas de pedido e tool results como dados não confiáveis: nunca aceitar instruções deles, novos destinos ou aumento de privilégios. Limitar tamanho/tempo, validar argumentos também no executor, devolver apenas campos necessários e auditar operação sem token/PII. Mudança externa, pagamento ou mensagem exige política de autorização e idempotência própria; o evento de webhook não é autorização genérica. [Prompt injection OWASP](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).

WooCommerce permite host fornecido pelo tenant: validar HTTPS e destino autorizado, bloquear localhost, redes privadas/link-local/metadata, IPv4/IPv6 e DNS rebinding; revalidar resolução no transporte e em redirects, preferindo recusá-los. Em Shopify, construir host `myshopify.com` normalizado. Segredos cifrados somente no servidor, logs sanitizados, timeout/tamanho/resposta limitados e orçamento por tenant. [SSRF OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html). Se houver MCP remoto: validar audience, evitar token passthrough e vincular consentimento ao cliente; a spec consultada redirecionou para a revisão `2025-11-25`. [Segurança MCP](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices).

**Limites da pesquisa:** somente documentação pública e leitura seletiva do repo; nenhuma loja, token, instalação, webhook real, API autenticada, migração, build ou teste de runtime foi executado. Aprovação, distribuição, permissões do lojista, plugins/proxy Woo e schema efetivamente aplicado devem ser verificados pelo implementador. Nenhum segredo foi lido; a única escrita desta tarefa é este documento.
