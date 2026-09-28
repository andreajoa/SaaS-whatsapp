---
impacto: nada_mudou
secao: corrigido
titulo: Onboarding volta a carregar o QR após uma falha transitória
---

A tela do telefone tenta novamente a imagem do QR enquanto a sessão aguarda
leitura. Gerar outro código também limpa o erro da imagem anterior.
Uma sessão interrompida não é mais apresentada como prova de código expirado.

A imagem em andamento permanece montada durante as consultas de status. A
renovação automática só acontece depois de concluir o carregamento, evitando
cancelamentos contínuos quando o servidor leva mais de três segundos.
