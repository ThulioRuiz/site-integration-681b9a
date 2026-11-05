import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.js";
import { rankingStats } from "../../db/schema.js";
import { displayName, json, requireUser, sameOrigin } from "@/server/auth.server";

const MAX_DAY = 24 * 60;
const syncInput = z.object({
  displayName: z.string().trim().max(40).optional(),
  exam: z.string().trim().max(20).default(""),
  totalMinutes: z.number().int().min(0).max(MAX_DAY * 365 * 10),
  weekKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekMinutes: z.number().int().min(0).max(MAX_DAY * 7),
  monthKey: z.string().regex(/^\d{4}-\d{2}$/),
  monthMinutes: z.number().int().min(0).max(MAX_DAY * 31),
  topicsDone: z.number().int().min(0).max(100000),
  streakDays: z.number().int().min(0).max(3650),
  questionsCorrect: z.number().int().min(0).max(1000000),
});

const PERIODS = ["semana", "mes", "total"] as const;

export const Route = createFileRoute("/api/ranking")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireUser();
        if ("error" in auth) return auth.error;
        const url = new URL(request.url);
        const p = url.searchParams.get("periodo");
        const period = PERIODS.find((x) => x === p) ?? "semana";
        const weekKey = url.searchParams.get("semana") ?? "";
        const monthKey = url.searchParams.get("mes") ?? "";
        const rows = await db.select().from(rankingStats).orderBy(desc(rankingStats.updatedAt)).limit(1000);
        const entries = rows
          .map((r) => ({
            userId: r.userId,
            name: r.displayName,
            exam: r.exam,
            minutes:
              period === "total"
                ? r.totalMinutes
                : period === "mes"
                  ? r.monthKey === monthKey
                    ? r.monthMinutes
                    : 0
                  : r.weekKey === weekKey
                    ? r.weekMinutes
                    : 0,
            topicsDone: r.topicsDone,
            streakDays: r.streakDays,
            questionsCorrect: r.questionsCorrect,
            me: r.userId === auth.user.id,
          }))
          .sort((a, b) => b.minutes - a.minutes || b.topicsDone - a.topicsDone)
          .slice(0, 100);
        return json({ period, entries });
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
        const parsed = syncInput.safeParse(body);
        if (!parsed.success) return json({ error: "Dados inválidos." }, 400);
        const d = parsed.data;
        const values = {
          displayName: d.displayName || displayName(auth.user),
          exam: d.exam,
          totalMinutes: d.totalMinutes,
          weekKey: d.weekKey,
          weekMinutes: d.weekMinutes,
          monthKey: d.monthKey,
          monthMinutes: d.monthMinutes,
          topicsDone: d.topicsDone,
          streakDays: d.streakDays,
          questionsCorrect: d.questionsCorrect,
          updatedAt: new Date(),
        };
        await db
          .insert(rankingStats)
          .values({ userId: auth.user.id, ...values })
          .onConflictDoUpdate({ target: rankingStats.userId, set: values });
        return json({ ok: true });
      },
      DELETE: async ({ request }) => {
        const bad = sameOrigin(request);
        if (bad) return bad;
        const auth = await requireUser();
        if ("error" in auth) return auth.error;
        await db.delete(rankingStats).where(eq(rankingStats.userId, auth.user.id));
        return json({ ok: true });
      },
    },
  },
});
