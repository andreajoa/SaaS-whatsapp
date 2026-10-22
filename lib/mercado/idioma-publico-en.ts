/** English is currently supported on the public acquisition journey, not inside the CRM UI. */
export const COOKIE_MERCADO_PUBLICO = "atenza_market";
export type MercadoIngles = "en-gb" | "en-us";
export const ehMercadoIngles = (x: string | null | undefined): x is MercadoIngles =>
  x === "en-gb" || x === "en-us";

export function mercadoInglesDoVisitante(
  pais: string | null,
  preferencia: string | null,
  acceptLanguage: string | null,
): MercadoIngles | null {
  if (ehMercadoIngles(preferencia)) return preferencia; // An explicit prior page selection wins.
  if (pais?.toUpperCase() === "GB") return "en-gb";
  if (pais?.toUpperCase() === "US") return "en-us";
  if (pais) return null; // Geo country known and not English-first: do not guess.
  const preferred = (acceptLanguage || "").split(",")[0]?.trim().toLowerCase() || "";
  if (preferred === "en-gb") return "en-gb";
  if (preferred === "en-us" || preferred === "en") return "en-us";
  return null;
}

/** English translations for the PUBLIC registration and sign-in flow only. */
const ENGLISH: Readonly<Record<string, string>> = {
  "Criar conta": "Create account",
  "Criando conta...": "Creating account...",
  "Comece a usar o": "Start using",
  "em minutos": "in minutes",
  "Já tem conta?": "Already have an account?",
  "Não tem conta?": "Don't have an account?",
  "Entrar": "Sign in",
  "Entrando...": "Signing in...",
  "Seu nome": "Your name",
  "Nome da empresa": "Company name",
  "Senha": "Password",
  "Confirmar senha": "Confirm password",
  "Email inválido": "Invalid email address",
  "Informe seu nome": "Enter your name",
  "Nome da empresa deve ter pelo menos 2 caracteres": "Company name must have at least 2 characters",
  "Nome da empresa deve ter no máximo 120 caracteres": "Company name must have no more than 120 characters",
  "Senha deve ter pelo menos 8 caracteres": "Password must have at least 8 characters",
  "As senhas não coincidem": "Passwords do not match",
  "Verifique seu e-mail": "Check your email",
  "Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha.": "If an account exists with that email address, we sent a password reset link.",
  "Email inválido. Confira o campo.": "Invalid email. Please check the address.",
  "Não foi possível enviar o e-mail. Tente novamente.": "We couldn't send the email. Please try again.",
  "Enviando...": "Sending...",
  "Enviar link de redefinição": "Send reset link",
  "Muitas tentativas. Aguarde alguns minutos.": "Too many attempts. Please wait a few minutes.",
  "Dados inválidos. Confira os campos.": "Invalid information. Please check the fields.",
  "Não foi possível criar a conta. Tente novamente.": "We couldn't create your account. Please try again.",
  "Email ou senha incorretos.": "Incorrect email or password.",
  "Erro inesperado. Tente novamente.": "Unexpected error. Please try again.",
  "Você já tem uma conta com este e-mail": "An account already exists for this email",
  "Entre com ela para aceitar o convite — não é preciso criar outra.": "Sign in to accept the invitation. You don't need another account.",
  "Entrar e aceitar o convite": "Sign in and accept invitation",
  "Confirme seu e-mail": "Confirm your email",
  "Enviamos um link de confirmação para": "We sent a confirmation link to",
  "Abra o e-mail e clique no link para ativar sua conta.": "Open the email and click the link to activate your account.",
  "Crie sua senha para entrar na empresa que te convidou": "Create a password to join the company that invited you",
  "Esse convite expirou ou não é mais válido. Peça um novo a quem te convidou — criar uma conta agora abriria uma empresa nova, e não é isso que você quer.": "This invitation has expired or is no longer valid. Request a new one from the sender; creating an account now would start a new company instead.",
  "Esqueci minha senha": "Forgot password?",
  "Recuperar senha": "Reset password",
  "Informe seu e-mail e enviaremos um link de redefinição": "Enter your email and we'll send you a password reset link",
  "Lembrou a senha?": "Remember your password?",
  "Senha redefinida com sucesso. Entre com a nova senha.": "Password reset successful. Sign in with your new password.",
  "Link inválido ou expirado. Peça um novo em Recuperar senha ou refaça o cadastro.": "Invalid or expired link. Request a new password reset link or sign up again.",
  "Sua conta foi confirmada, mas houve um erro ao preparar seu ambiente. Tente entrar novamente em instantes.": "Your account was confirmed, but we couldn't finish setting it up. Please try signing in again shortly.",
  "Sua conta foi confirmada, mas o convite não vale mais — ele expirou ou foi emitido para outro e-mail. Peça um novo a quem te convidou. Não criamos uma empresa nova para você, porque não era isso que você estava fazendo.": "Your account was confirmed but the invitation is no longer valid. Ask the sender for a new invitation. We have not created a new company for you.",
  "Não conseguimos confirmar seu e-mail por este link. Clique em «Esqueci minha senha», use o mesmo e-mail e siga o link que vamos enviar — ele confirma sua conta. Se não chegar em alguns minutos, fale com o nosso suporte.": "We couldn't confirm your email using this link. Select 'Forgot password?', enter the same email and follow the link we send. Contact support if it doesn't arrive.",
};
export function traduzirAcessoEmIngles(texto: string): string {
  return ENGLISH[texto] ?? texto;
}
