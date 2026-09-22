/**
 * Os caminhos que o funil MEDE, e por que eles moram sozinhos num arquivo.
 *
 * Este módulo não importa nada. Não pode: quem o lê são os dois extremos — o
 * beacon, que é componente de cliente e roda no navegador, e o varredor de
 * carrinho largado, que é cron e usa a service key. Qualquer import de
 * `next/headers`, do cliente do Supabase ou de `env` tornaria o arquivo
 * server-only e quebraria o build do lado do navegador.
 *
 * E eles PRECISAM concordar: o beacon grava a string, o varredor a procura. Se
 * cada lado escrevesse a sua, a consulta devolveria zero para sempre e o
 * sintoma seria "o e-mail de carrinho largado nunca sai" — sem erro, sem log,
 * sem nada que aponte para a letra trocada.
 */

/**
 * A âncora da tabela de preço na página de vendas.
 *
 * É constante, e não a string solta que era, porque TRÊS lugares dependem de
 * ela ser a mesma: a seção que a declara (`app/page.tsx`), o menu que salta
 * para ela, e o observador do beacon que mede quem chegou lá. Os e-mails
 * apontavam para `#precos` enquanto a seção se chamava `planos` — doze CTAs,
 * nos três idiomas, levando a lugar nenhum. Não dava erro: o navegador abre a
 * página no topo e ninguém nunca saberia que o link não fez o que prometia.
 */
export const ID_DA_SECAO_DE_PLANOS = "planos";

/** O destino de um CTA de e-mail que manda a pessoa ver o preço. */
export const CAMINHO_DOS_PLANOS = `/#${ID_DA_SECAO_DE_PLANOS}`;

/**
 * O marco de "chegou à tabela de preço".
 *
 * Não é uma rota — não existe página em `/planos`, a tabela é uma seção da
 * página de vendas. É um caminho SINTÉTICO, gravado em `site_visits.path` para
 * registrar um ato que a navegação sozinha não registra, porque o `#planos` é
 * fragmento e fragmento nunca chega ao servidor.
 *
 * A barra inicial e o formato de caminho são de propósito: a coluna é a mesma
 * das visitas de verdade, e o painel a lista junto. Um marco com formato de
 * caminho aparece na lista de páginas mais vistas e se explica sozinho; um
 * marco escrito `viu_preco` viraria uma linha que ninguém entende.
 */
export const CAMINHO_DO_PRECO = `/${ID_DA_SECAO_DE_PLANOS}`;
