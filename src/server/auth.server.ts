import { getUser, type User } from "@netlify/identity";

const NO_STORE = { "Cache-Control": "private, no-store" };

export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: NO_STORE });

export const displayName = (u: User) => (u.name?.trim() || u.email?.split("@")[0] || "Recruta").slice(0, 60);

export const isAdmin = (u: User) => !!u.roles?.includes("admin") || u.role === "admin";

/** Retorna o usuário logado ou uma resposta 401 pronta para devolver. */
export async function requireUser(): Promise<{ user: User } | { error: Response }> {
  const user = await getUser();
  if (!user) return { error: json({ error: "Faça login para continuar." }, 401) };
  return { user };
}

/** Bloqueia mutações vindas de outra origem (proteção contra CSRF). */
export function sameOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    if (new URL(origin).host === new URL(request.url).host) return null;
  } catch {
    /* cai no erro abaixo */
  }
  return json({ error: "Origem não permitida." }, 403);
}
