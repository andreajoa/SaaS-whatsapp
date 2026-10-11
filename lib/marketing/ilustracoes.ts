/**
 * A ilustração de cada página editorial — uma por página, sem repetir.
 *
 * Render 3D (argila fosca e vidro, paleta da marca) gerado no Google Flow em
 * 11/10/2026 e recortado com fundo transparente (ISNet), para o objeto flutuar
 * sobre a página em vez de aparecer dentro de uma moldura de foto.
 */
const ALT: Record<string, string> = {
  "atendimento-whatsapp":
    "Ilustração: balões de conversa em volta de um celular, ligados a três atendentes",
  "chatbot-para-whatsapp": "Ilustração: um pequeno robô verde segurando um balão de conversa",
  "agentes-ia-whatsapp":
    "Ilustração: esfera de vidro com uma estrela de inteligência artificial sobre um celular",
  "crm-whatsapp": "Ilustração: quadro kanban com cartões passando entre as colunas do funil",
  "atendimento-whatsapp-sao-paulo":
    "Ilustração: miniatura de cidade com balões de conversa sobre os prédios",
  "guias/como-escolher-atendimento-whatsapp":
    "Ilustração: guia aberto com lista de verificação e uma lupa",
  "recursos/campanhas-whatsapp": "Ilustração: megafone verde com balões de conversa saindo dele",
  "recursos/follow-up-automatico":
    "Ilustração: setas em círculo em volta de um balão de conversa e um relógio",
  "recursos/agenda-whatsapp":
    "Ilustração: calendário com um dia marcado, despertador e câmera de vídeo",
  "recursos/integracoes": "Ilustração: peças de quebra-cabeça conectadas a um celular",
  "recursos/api-whatsapp":
    "Ilustração: bloco de vidro com sinais de código ligado a pontos de conexão",
  "recursos/lgpd-whatsapp": "Ilustração: escudo com cadeado diante de uma pilha de documentos",
  "recursos/relatorios-atendimento": "Ilustração: gráfico de barras, medidor e selo de avaliação",
  "segmentos/clinicas": "Ilustração: dente, calendário e celular com balão de conversa",
  "segmentos/e-commerce": "Ilustração: sacola de compras, caixa de entrega e celular",
  "segmentos/escolas": "Ilustração: pilha de livros com capelo de formatura e balão de conversa",
  "segmentos/imobiliarias": "Ilustração: casinha com chave e balão de conversa",
  "segmentos/advogados": "Ilustração: balança da justiça ao lado de documentos",
  "segmentos/restaurantes": "Ilustração: prato com cloche, sacola de entrega e celular",
  "segmentos/agencias": "Ilustração: cartões de cores de marca com um foguete",
  "segmentos/servicos": "Ilustração: caixa de ferramentas com chave inglesa e calendário",
};

export function ilustracaoDaPagina(slug: string): { src: string; alt: string } | null {
  const alt = ALT[slug];
  return alt ? { src: `/media/atenza/ilustracoes/${slug.replace("/", "_")}.webp`, alt } : null;
}
