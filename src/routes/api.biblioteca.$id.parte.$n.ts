import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { libraryBooks } from "../../db/schema.js";
import { json, requireUser, sameOrigin } from "@/server/auth.server";
import { libraryStore, partKey } from "@/server/library.server";
import { PART_SIZE } from "@/lib/library";

function parsePart(raw: string, parts: number) {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n < parts ? n : null;
}

export const Route = createFileRoute("/api/biblioteca/$id/parte/$n")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const auth = await requireUser();
        if ("error" in auth) return auth.error;
        const [row] = await db.select().from(libraryBooks).where(eq(libraryBooks.id, params.id)).limit(1);
        if (!row || row.status !== "ready") return json({ error: "Livro não encontrado." }, 404);
        const n = parsePart(params.n, row.parts);
        if (n === null) return json({ error: "Parte inválida." }, 400);
        const data = await libraryStore().get(partKey(row.id, n), { type: "arrayBuffer" });
        if (!data) return json({ error: "Parte do arquivo não encontrada." }, 404);
        return new Response(data, {
          headers: { "content-type": "application/octet-stream", "Cache-Control": "private, max-age=3600" },
        });
      },
      PUT: async ({ request, params }) => {
        const bad = sameOrigin(request);
        if (bad) return bad;
        const auth = await requireUser();
        if ("error" in auth) return auth.error;
        const [row] = await db.select().from(libraryBooks).where(eq(libraryBooks.id, params.id)).limit(1);
        if (!row || row.uploadedBy !== auth.user.id || row.status !== "uploading") {
          return json({ error: "Envio não encontrado." }, 404);
        }
        const n = parsePart(params.n, row.parts);
        if (n === null) return json({ error: "Parte inválida." }, 400);
        const buf = await request.arrayBuffer();
        const expected = n === row.parts - 1 ? row.sizeBytes - n * PART_SIZE : PART_SIZE;
        if (buf.byteLength !== expected) return json({ error: "Parte com tamanho inesperado." }, 400);
        if (n === 0) {
          const head = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(5, buf.byteLength)));
          if (head !== "%PDF-") return json({ error: "O arquivo não parece ser um PDF." }, 400);
        }
        await libraryStore().set(partKey(row.id, n), buf);
        return json({ ok: true });
      },
    },
  },
});
