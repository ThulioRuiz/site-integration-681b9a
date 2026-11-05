import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { libraryBooks } from "../../db/schema.js";
import { isAdmin, json, requireUser, sameOrigin } from "@/server/auth.server";
import { deleteBookParts, libraryStore, partKey } from "@/server/library.server";

async function findBook(id: string) {
  const [row] = await db.select().from(libraryBooks).where(eq(libraryBooks.id, id)).limit(1);
  return row;
}

export const Route = createFileRoute("/api/biblioteca/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const auth = await requireUser();
        if ("error" in auth) return auth.error;
        const row = await findBook(params.id);
        if (!row || row.status !== "ready") return json({ error: "Livro não encontrado." }, 404);
        const { status: _s, ...b } = row;
        return json({
          book: { ...b, createdAt: b.createdAt.toISOString(), canDelete: isAdmin(auth.user) || b.uploadedBy === auth.user.id },
        });
      },
      /** Finaliza o envio: confere se todas as partes chegaram e publica o livro. */
      PATCH: async ({ request, params }) => {
        const bad = sameOrigin(request);
        if (bad) return bad;
        const auth = await requireUser();
        if ("error" in auth) return auth.error;
        const row = await findBook(params.id);
        if (!row || row.uploadedBy !== auth.user.id) return json({ error: "Livro não encontrado." }, 404);
        const store = libraryStore();
        for (let n = 0; n < row.parts; n++) {
          const meta = await store.getMetadata(partKey(row.id, n));
          if (!meta) return json({ error: "O envio ficou incompleto. Tente de novo." }, 409);
        }
        await db.update(libraryBooks).set({ status: "ready" }).where(eq(libraryBooks.id, row.id));
        return json({ ok: true });
      },
      DELETE: async ({ request, params }) => {
        const bad = sameOrigin(request);
        if (bad) return bad;
        const auth = await requireUser();
        if ("error" in auth) return auth.error;
        const row = await findBook(params.id);
        if (!row) return json({ error: "Livro não encontrado." }, 404);
        if (row.uploadedBy !== auth.user.id && !isAdmin(auth.user)) {
          return json({ error: "Só quem enviou o livro pode removê-lo." }, 403);
        }
        await deleteBookParts(row.id, row.parts);
        await db.delete(libraryBooks).where(eq(libraryBooks.id, row.id));
        return json({ ok: true });
      },
    },
  },
});
