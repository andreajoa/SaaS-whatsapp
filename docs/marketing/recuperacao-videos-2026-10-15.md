# Recuperação das páginas comerciais com vídeos

A publicação da página francesa partiu de `main`, enquanto a experiência com vídeos estava na branch `feat/atenza-experiencia-integracoes` (`18283e3`). O PR #15 reutilizou a home antiga dessa `main`. Esta correção recupera os componentes, as imagens, os vídeos e as páginas comerciais daquela branch sem promover suas mudanças no CRM, banco ou cobrança.

A página `/fr` e seu vídeo `/videos/atenza-fr.mp4` são preservados. As URLs `/mx`, `/en-us` e `/en-gb` continuam públicas e passam a renderizar as experiências recuperadas no idioma correspondente. As páginas `/es/{mexico,colombia,argentina,chile,peru,espana}`, `/de`, `/us` e `/en` voltam a abrir sem sessão. O sitemap mantém a França e inclui as páginas recuperadas.

Os arquivos comerciais de vídeo têm nomes explicitamente permitidos em `lib/auth/public-paths.ts`; não se libera uma pasta arbitrária. `lib/auth/public-paths.test.ts` protege o acesso público e os limites privados. O player possui testes em `components/site/VideosDaHome.test.tsx`.

O funil continua recebendo visitas e cliques pelo `Medidor`, incluindo os eventos do player. Os links de planos usam `/precos#planos`. Nenhuma variável nova, migração ou alteração de preço é necessária.
