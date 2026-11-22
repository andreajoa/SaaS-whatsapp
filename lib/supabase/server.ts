/**
 * Supabase client para Server Components, Route Handlers e Server Actions.
 *
 * Lê/escreve cookies via next/headers. Sempre use `getUser()` (valida JWT no
 * backend), NUNCA `getSession()` (confia no cookie local sem revalidar).
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookieSecure } from "@/lib/supabase/cookie-secure";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/** Nome canônico do cookie de sessão Supabase (compartilhado com proxy e home). */
export const SESSION_COOKIE_NAME = "sb-deskcomm-auth";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll pode ser chamado de Server Component; nesse caso, ignoramos.
          // Refresh de sessão acontece no middleware do Next.
        }
      },
    },
    // D-01.01: cookie name canônico alinhado ao middleware.
    // SameSite=Lax (OWASP / RFC 6265bis): bloqueia CSRF em POSTs cross-site e
    // preserva a sessão em navegações GET top-level vindas do Stripe Billing
    // Portal, retornos 3DS/Pix/Boleto e links de e-mail.
    cookieOptions: {
      name: SESSION_COOKIE_NAME,
      sameSite: "lax",
      httpOnly: true,
      secure: cookieSecure(),
      path: "/",
    },
  });
}
