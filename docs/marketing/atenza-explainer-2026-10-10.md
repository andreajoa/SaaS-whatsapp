# Vídeo explicativo da Atenza — entrega e origem

- Visual composition and Portuguese script: original work authored for this project, based on the approved Atenza mockup and verified product scope. Diagram labels are illustrative; there are no customer records, testimonials or invented numerical results.
- Narration: AI Voice Generator installed tool, voice `clear`, job `b7f873ca00f444419eed86708cd1680e`, original text supplied in full. Download frozen locally as `assets/narration.mp3`, 45.384 seconds. No subscription purchase or upgrade. Generic synthetic narration, no cloned identity.
- Rights source checked 2026-10-10: https://www.aidocmaker.com/terms-of-service, Intellectual Property section: generated content rights remain with the creator. Permits service use for personal and business purposes. Source terms not represented as public-domain material.
- Hanken Grotesk: local font cache originally sourced from Google Fonts, SIL Open Font License. Source https://github.com/HankenDesignCo/Hanken-Grotesk.
- GSAP 3.14.2: frozen runtime downloaded from jsDelivr official npm distribution. Render tooling only; not shipped in the website video. Source https://gsap.com/community/standard-license/.
- No copyrighted competitor media, no stock footage, no background music used in this explanatory video.
- WebVTT timing: acoustic transcription in Portuguese, reviewed against original script. Final video includes a 0.6 second lead before voice.

## Arquivos entregues

| Arquivo | Características verificadas |
| --- | --- |
| `public/media/atenza/atenza-explica.mp4` | 48,000 segundos; 1280×720; 24 fps; H.264 e AAC; 1.129.237 bytes; MP4 faststart, com `moov` antes de `mdat` |
| `public/media/atenza/explainer-poster.webp` | Quadro extraído em 2,7s da edição final; 1280×720; WebP; 19.940 bytes |
| `public/media/atenza/atenza-explica.vtt` | 17 legendas PT-BR, 1.318 bytes; transcrição acústica conferida com o roteiro; offset de voz 0,6s; intervalo 0,600–45,920s |

Fonte editável local: `design-preview/atenza-video/`. Original renderizado: `renders/atenza-explica-source.mp4`, 1920×1080, H.264/AAC, 4.467.298 bytes. A composição foi renderizada em Hyperframes 0.8.145, sem Docker, em 4m49,6s (captura screenshot, GPU software).

## Verificação

- Hyperframes: sem erros de runtime, layout ou contraste; 48/48 verificações de contraste de texto aprovadas. Oito avisos de organização da timeline foram revisados; são sugestões de decomposição em subcomposições e não defeitos de mídia.
- Seis momentos inspecionados no contact sheet. Diagrama original marcado como visão ilustrativa, sem interface, clientes ou métricas fabricados.
- Decodificação completa do MP4 final pelo FFmpeg aprovada, sem erros.
- Streams e duração conferidos por `ffprobe`; átomos MP4 conferidos para carregamento progressivo.
- Voz normalizada em duas passagens de loudnorm: saída integrada −16,0 LUFS, pico real −1,6 dBTP e LRA 3,4 LU. Vídeo preservado sem recodificar os quadros nessa etapa.
- O Whisper inicial com alinhamento DTW excedeu o limite automático de 454s. A etapa de legendas foi refeita em CPU, sem DTW e sem flash attention, com o modelo multilíngue tiny oficial e beam 1. O render concluído foi preservado. Modelo de transcrição local: https://huggingface.co/ggerganov/whisper.cpp; não há upload do áudio para transcrever.
- Legendas concluídas pelo Whisper tiny multilíngue local em 188,6 segundos. Nome Atenza, flexões e pontuação foram conferidos com o texto original; três fragmentos curtos foram unidos às frases anteriores, preservando as fronteiras acústicas. O texto concatenado das 17 legendas corresponde exatamente ao roteiro original. Máximo de duas linhas e 42 caracteres por linha, tempos ordenados, sem sobreposição e dentro dos 48 segundos.
- Integração no site: somente um clique inicia o player com áudio no mesmo bloco da capa; há controles, legenda e transcrição. Não abre modal. O CTA da abertura aponta para esse bloco.

## Capa própria

`public/media/atenza/explainer-thumbnail.webp`: fotografia ilustrativa gerada
pelo recurso integrado `image_gen` em 10/10/2026, otimizada em WebP 1280 × 720.
A pessoa retratada não representa integrante da equipe, depoente ou narradora.
Direção: profissional brasileira com headset e blusa verde, à direita de um
escritório com luz natural, madeira clara, plantas e espaço verde à esquerda.
Sem texto, logos ou controles incorporados à fotografia. Título e botão de
play são HTML, legíveis no celular; a capa é substituída pelo vídeo sem mudar
o enquadramento do bloco. O arquivo anterior de pôster permanece como registro
da edição original, sem uso como thumbnail na página.

## Roteiro falado

Seu cliente mandou uma mensagem. E agora? Com o Atenza, seu time organiza o atendimento pelo WhatsApp em uma caixa de entrada compartilhada. As conversas têm contexto, responsáveis e um próximo passo claro. Configure seu agente de inteligência artificial com o conhecimento do seu negócio e as credenciais do seu provedor. Ele ajuda com as dúvidas da rotina, e sua equipe assume quando o atendimento precisa de atenção humana. Depois, acompanhe as oportunidades no funil e organize os retornos. As integrações disponíveis conectam sua operação, conforme a configuração de cada serviço. Menos improviso. Mais atenção em cada conversa. Conheça os planos do Atenza. Comece com sete dias sem cobrança. É necessário cartão.
