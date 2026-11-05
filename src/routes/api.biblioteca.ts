import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.js";
import { libraryBooks } from "../../db/schema.js";
import { displayName, isAdmin, json, requireUser, sameOrigin } from "@/server/auth.server";
import { MAX_PDF_BYTES, PART_SIZE } from "@/lib/library";

const createInput = z.object({
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().max(200).default(""),
  subject: z.string().trim().max(80).default(""),
  exam: z.string().trim().max(20).default(""),
  description: z.string().trim().max(1000).default(""),
  fileName: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive().max(MAX_PDF_BYTES),
  parts: z.number().int().positive(),
});

export const Route = createFileRoute("/api/biblioteca")({
  server: {
    handlers: {
      GET: async () => {
        const auth = await requireUser();
        if ("error" in auth) return auth.error;
        const rows = await db
          .select()
          .from(libraryBooks)
          .where(eq(libraryBooks.status, "ready"))
          .orderBy(desc(libraryBooks.createdAt));
        const admin = isAdmin(auth.user);
        return json({
          books: rows.map(({ status: _s, ...b }) => ({
            ...b,
            createdAt: b.createdAt.toISOString(),
            canDelete: admin || b.uploadedBy === auth.user.id,
          })),
        });
      },
      POST: async ({ request }) => {
        const bad = sameOrigin(request);
        if (bad) return bad;
        const auth = await requireUser();
        if ("error" in auth) return auth.error;
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Dados inválidos." }, 400);
        }
        const parsed = createInput.safeParse(body);
        if (!parsed.success) return json({ error: "Confira título e arquivo (PDF de até 150 MB)." }, 400);
        const d = parsed.data;
        if (!d.fileName.toLowerCase().endsWith(".pdf")) return json({ error: "Envie um arquivo PDF." }, 400);
        if (d.parts !== Math.max(1, Math.ceil(d.sizeBytes / PART_SIZE))) return json({ error: "Arquivo inválido." }, 400);
        const id = crypto.randomUUID();
        await db.insert(libraryBooks).values({
          id,
          title: d.title,
          author: d.author,
          subject: d.subject,
          exam: d.exam,
          description: d.description,
          fileName: d.fileName,
          sizeBytes: d.sizeBytes,
          parts: d.parts,
          status: "uploading",
          uploadedBy: auth.user.id,
          uploadedByName: displayName(auth.user),
        });
        return json({ id }, 201);
      },
    },
  },
});
