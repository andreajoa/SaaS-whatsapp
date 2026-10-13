# Item 23 — vídeos dos guias em espanhol e inglês

## Retomada em 13/10/2026

Projeto: `SaaS-whatsapp-experiencia`, branch `feat/atenza-experiencia-integracoes`.
Último commit ao retomar: `81c2ec2` (guias em português).
Fonte da interrupção: sessão Claude `04e5832f-242a-4fb5-8a74-6c298e61c9ee`,
encerrada por limite semanal em 13/10 às 10h10 BRT.

| Entrega | Confirmado ao retomar | Falta |
|---|---|---|
| Roteiros ES/EN | 40/40 falas em cenas-es/en.json | — |
| Áudios ES | 20/20 WAV + transcrições | Revisão final |
| Áudios EN | 5/20 WAV (OpenAI) | 15 falas + transcrição |
| Vídeos ES | 2/4 MP4 + WebP (OpenAI e Anthropic) | Google e OpenRouter + revisão |
| Vídeos EN | 0/4 | 4 renders + revisão |
| Integração | 3 arquivos alterados pelo Claude | Validar junto com as mídias |
| Publicação ES/EN | Não realizada | Commit, CI, deploy, promoção e prova em produção |

O histórico declara 23/24 itens gerais concluídos (96%). Essa porcentagem é um
relato anterior, não uma auditoria independente dos outros 23 itens. Neste registro,
o progresso do item 23 é medido por artefatos e verificações, sem misturar geração
de áudio, renderização e publicação.

## Trabalho retomado

- Render ES de Google/OpenRouter iniciado com `montar.py --idioma es google openrouter`.
- Geração EN retomada com `vozes_idioma.py en`, preservando os cinco WAV existentes.
- Logs em `design-preview/videos/guia-chave/retomada-render-es.log` e
  `retomada-vozes-en.log`.
- Não reutilizar `pipeline_idiomas.sh` sem revisão: contém `pkill` global de Chrome
  e não interrompe o pipeline quando uma etapa falha.
- Habilitar no site apenas idiomas cujos quatro vídeos estejam presentes e validados.

## Critérios de conclusão

- [ ] 40 áudios completos e transcrições conferidas.
- [ ] 8 MP4 e 8 pôsteres válidos, com revisão visual.
- [ ] Arquivos copiados para `public/media/atenza`.
- [ ] Testes, lint e typecheck aprovados.
- [ ] Commit identificado e CI aprovado.
- [ ] Publicação e reprodução dos vídeos verificadas nas páginas ES/EN.

## Medição e retomada

### Marco 13/10, 10h30 BRT

- ES: 4/4 MP4 e 4/4 pôsteres prontos e copiados para `public/media/atenza`.
- MP4 validados com ffprobe: H.264 1280×720 + áudio AAC. Revisão visual dos
  quadros de Google e OpenRouter aprovada; as legendas vêm do roteiro.
- Testes de mídia e marca: **54/54 aprovados**. Antes de copiar os arquivos,
  o teste de mídia falhou como esperado para o vídeo ES ausente (24 passaram,
  1 falhou), provando que a verificação detecta links quebrados.
- Typecheck inicial aprovado; verificação final e lint em andamento.
- EN: 7/20 áudios; processo de retomada ativo aguardando o prazo da quota.
- Publicação ES ainda pendente de commit, CI e promoção.

`python3 scripts/medir-videos-guias.py` produz JSON com duração de cada áudio,
presença de transcrição, validade de cada render e presença dos arquivos em public/.
A presença em public/ não é prova de publicação.

13/10, 10h24 BRT: inglês avançou para 7/20. A API respondeu `429`, quota
`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, limite 10 para
`gemini-3.8-flash-tts`, com `retryDelay=38156s`. A tentativa repetitiva foi
encerrada. Próxima tentativa conservadora: **13/10 às 21h01 BRT**
(`2026-10-14T00:01:00Z`), sem trocar a voz Charon ou ativar cobrança.

O comando `python3 -u scripts/retomar-videos-guias.py --not-before 2026-10-14T00:01:00Z`
preserva os WAV válidos, respeita novos prazos de quota, transcreve, renderiza e copia
os quatro vídeos EN. Usa lock para impedir duplicação e grava cada etapa em
`design-preview/videos/guia-chave/retomada-en-estado.json`. Ao terminar, exige revisão,
habilitação de EN em `IDIOMAS_COM_VIDEO`, ajuste do teste de espera de EN, commit,
CI e publicação. Não promove nem altera o código da aplicação sozinho.

## Integração existente — checklist do sistema vivo

- Entrada: `guiaNoIdioma` recebe idioma e marca; mídia deriva dos roteiros locais.
- Saída: `GuiaDaChaveDeIa` renderiza o vídeo do provedor selecionado.
- Registro: o evento de reprodução já é capturado por `components/site/Medidor.tsx`.
- Tela e acesso: `/es/ayuda/clave-de-ia`, central de ajuda e guia de Credenciais.
- Continuidade: os passos escritos e links dos provedores permanecem disponíveis.
- Configuração: lista explícita `IDIOMAS_COM_VIDEO`; EN ainda não habilitado.
- Retorno: `midia-publica-da-vitrine.test.ts` reprova mídia ausente ou privada;
  o medidor operacional mostra geração incompleta e o worker registra falha.
- Não há nova entidade, rota ou fluxo IA/humano; reutiliza as ligações existentes.
