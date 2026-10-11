# Ativos da nova página pública Atenza

Data: 10 de outubro de 2026. Escopo: fotografias de contexto e vídeo silencioso. O vídeo explicativo, sua narração e legendas têm um registro próprio.

## Origem e uso

As imagens de escritório e segmentos foram geradas pelo recurso integrado `image_gen`, sem API externa ou assinatura adicional. São cenas ilustrativas; as pessoas não são integrantes da equipe, clientes, depoentes ou parceiros da Atenza. Os arquivos finais são fotografias separadas, sem texto ou interface incorporados. Os mockups completos de aprovação não são conteúdo da página.

O vídeo de atendimento é filmagem real de banco de mídia por **Jep Gambardella**, publicada na Pexels: [Woman Working in Call Center, clip 7661547](https://www.pexels.com/video/woman-working-in-call-center-7661547/). Licença consultada em 10/10/2026: [Pexels License](https://www.pexels.com/license/) e [orientação oficial de uso comercial](https://help.pexels.com/hc/en-us/articles/360042295214-Can-I-use-the-photos-and-videos-for-a-commercial-project). A licença permite uso comercial e modificações, sem exigir atribuição. Ela proíbe sugerir endosso da pessoa retratada, revender a mídia sem alteração ou usá-la como marca. Portanto, a página deve tratar a cena como **contexto ilustrativo**, sem atribuir à pessoa cargo na Atenza, depoimento, estatística ou declaração de apoio. A mídia não é descrita como domínio público ou sem direitos autorais.

Arquivo fonte oficial baixado: `https://videos.pexels.com/video-files/7661547/7661547-uhd_3840_2160_25fps.mp4`. Trecho final: segundos 2 a 10; redimensionamento proporcional, H.264, `yuv420p`, sem stream de áudio, MP4 com `faststart`. O pôster é um quadro aos 3 segundos do mesmo vídeo, sem alterações criativas. Fonte integral mantida fora do repositório; a página usa somente os derivados leves.

## Arquivos finais

Todos os caminhos abaixo ficam em `public/media/atenza/`.

| Arquivo | Dimensões | Tamanho em bytes | Origem |
| --- | --- | ---: | --- |
| `public/media/atenza/hero-office.webp` | 1600 × 901 | 86018 | Geração integrada, escritório sem pessoas |
| `public/media/atenza/segmento-comercio.webp` | 1000 × 563 | 65314 | Geração integrada, preparo de encomenda |
| `public/media/atenza/segmento-clinica.webp` | 1000 × 563 | 39422 | Geração integrada, recepção sem pacientes |
| `public/media/atenza/segmento-educacao.webp` | 1000 × 563 | 38906 | Geração integrada, administração escolar adulta |
| `public/media/atenza/segmento-servicos.webp` | 1000 × 563 | 43036 | Geração integrada, consultora de serviços |
| `public/media/atenza/atendimento.webp` | 1280 × 720 | 32786 | Quadro da filmagem Pexels 7661547 |
| `public/media/atenza/atendimento-loop.mp4` | 1280 × 720, 8 segundos | 433284 | Trecho da filmagem Pexels 7661547 |

As imagens foram convertidas para WebP com qualidade 82 e redimensionamento proporcional, sem recorte ou modificação generativa posterior. Na interface, usar enquadramento responsivo e texto alternativo pertinente. O fundo decorativo do hero deve ter texto alternativo vazio.

## Prompts de geração

Modo usado: recurso integrado `image_gen`; cinco chamadas independentes, uma fotografia por ativo. Os mockups aprovados foram inspecionados como direção visual, sem extração dos blocos completos da página.

### `public/media/atenza/hero-office.webp`

> Use case: photorealistic-natural. Asset type: real photographic background for Atenza website hero, ONLY photo, no website mockup. Generate one landscape 16:9 editorial architecture photograph of a calm Brazilian small-business office, warm mineral ivory plaster walls, oak desk at lower edge, dark forest-green structural frames, natural leafy houseplants on far left and right, soft morning window light. Center and upper 65% is clean pale wall with abundant negative space, no people, no computer screens, no UI. Understated authentic texture, realistic not CGI, no gradients or cinematic neon, no text, no logos, no lettering, no watermarks. Full-bleed photo. Palette warm white #F5F7F2, oak, muted forest. Must remain useful behind centered HTML headline on narrow mobile screens.

### `public/media/atenza/segmento-comercio.webp`

> Use case: photorealistic-natural. Asset type: standalone editorial photograph for an Atenza business website segment card. ONLY ONE PHOTO, no UI or page mockup. Landscape 16:9 photo of Brazilian small e-commerce owner woman age around32 with dark tied-up curly hair, candid friendly expression looking down while carefully packing tissue paper into a plain unbranded cardboard parcel on oak work table, laptop screen facing away, several orderly parcels and clothes racks behind her. Contemporary small Brazilian shop, natural plants, warm soft daylight and authentic neutral materials, dark forest green casual short sleeve top and beige apron. Medium shot centered chest-up plus hands visibly performing real action, natural anatomy and five fingers. Genuine tactile editorial photography, not staged stock advertising grin, no lettering, no logos, no watermark, no text, no digital overlays.

### `public/media/atenza/segmento-clinica.webp`

> Use case: photorealistic-natural. Asset type: standalone Atenza website business-segment photo, ONLY ONE photograph no UI or page. Landscape16:9 natural editorial photography of a Brazilian clinic receptionist woman around35, medium brown skin, shoulder length dark wavy hair, dark forest-green cotton blouse, using a modest headset and laptop at the reception desk of an airy contemporary small outpatient clinic in Brazil. Candid professional expression focused on monitor with a very slight smile, waist-up front three-quarter view, face near center. Warm ivory walls, plant, oak desk, softly blurred empty waiting area, no patients or medical procedures. Soft daylight, credible skin texture, warm muted greens and neutral mineral palette, premium understated editorial photograph. No visible writing on screens or walls, no lettering, no logos or name badge text, no watermark, no infographic, no floating calendar or digital overlays.

### `public/media/atenza/segmento-educacao.webp`

> Use case: photorealistic-natural. Asset type: standalone Atenza website business-segment editorial photo, ONLY ONE photographic scene. Landscape16:9. A Brazilian young adult education administrator male around34 with glasses, dark curly hair and short beard, wearing dark forest-green casual overshirt over cream t-shirt, seated at an oak desk with laptop, looking at laptop attentively and naturally smiling while reviewing enrollment enquiries. A contemporary school office, warm neutral walls, books on shelving, small plant, an empty blank chalkboard out of focus in background. No children or classroom teaching; portrays adult staff handling administration. Medium waist-up three-quarter shot, centered face with useful context at sides. Realistic texture, candid editorial photography, gentle natural window light, pale mineral and forest palette. No text, no writing, no logos, no visible screen contents, no UI overlay, no watermark.

### `public/media/atenza/segmento-servicos.webp`

> Use case: photorealistic-natural. Asset type: standalone Atenza website business-segment editorial photograph, ONLY ONE PHOTO. Landscape16:9. A Brazilian female B2B service consultant around38, olive skin, shoulder-length wavy dark hair, wearing a simple charcoal-green blouse, seated at an oak desk in a modest warm modern office and thoughtfully reading messages on a computer, hand lightly near chin, natural relaxed attentive expression. Computer screen facing away so no visible data. Blur a colleague far in background without identifiable face. Plants, ivory plaster, window daylight, genuine small-business Brazilian setting. Medium front three-quarter torso-up shot, her face near center, include laptop and desk context. Authentic real editorial photography with gentle filmic texture, warm mineral white, oak and muted forest green. No text, no logos, no letters, no watermarks, no testimonials, no visible UI, no floating graphic.

## Verificação realizada

- Inspeção visual de todas as cinco fotografias finais: contexto adequado, sem texto, logos, dados de clientes ou interface gerada.
- Inspeção de uma folha de contato com início, meio e fim do trecho do vídeo: ação natural de atendimento, enquadramento consistente, sem conteúdo sensível ou marcas visíveis.
- `ffprobe`: duração de 8,000 segundos; único stream de vídeo H.264; ausência de áudio; dimensões 1280 × 720; `yuv420p`.
- Dimensões e tamanhos finais conferidos localmente. Total dos sete ativos: 738766 bytes, aproximadamente 0,74 MB.

A implementação deve respeitar a preferência por movimento reduzido e oferecer pausa para o loop. O vídeo explicativo com áudio só deve iniciar por ação do visitante; essas responsabilidades pertencem ao componente da página, não aos arquivos de mídia.
