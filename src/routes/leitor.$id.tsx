import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Download, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/kit";
import { SessionDialog } from "@/components/SessionDialog";
import { downloadPdf, fmtBytes, getLibraryBook } from "@/lib/library";
import { ymd } from "@/lib/calc";

export const Route = createFileRoute("/leitor/$id")({
  head: () => ({
    meta: [
      { title: "Leitor — Quartel de Estudos" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LeitorPage,
});

function LeitorPage() {
  const { id } = Route.useParams();
  const meta = useQuery({ queryKey: ["biblioteca", id], queryFn: () => getLibraryBook(id) });
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const book = meta.data;
  useEffect(() => {
    if (!book) return;
    let active = true;
    let objectUrl: string | null = null;
    setUrl(null);
    setError(null);
    setProgress(0);
    downloadPdf(book, (p) => active && setProgress(p))
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : "Falha ao abrir o PDF."));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [book]);

  return (
    <div className="mx-auto flex h-[calc(100dvh-8.5rem)] max-w-6xl flex-col md:h-[calc(100dvh-4rem)]">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/livros"><ArrowLeft /> Livros</Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-brass">Biblioteca</p>
          <h1 className="truncate text-2xl font-bold uppercase leading-none md:text-3xl">
            {book?.title ?? (meta.isError ? "Livro indisponível" : "Abrindo…")}
          </h1>
          {book && (
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {book.author && <span>{book.author} ·</span>}
              <span>{fmtBytes(book.sizeBytes)}</span>
              {book.subject && <Badge variant="secondary">{book.subject}</Badge>}
              {book.exam && <Badge variant="outline">{book.exam}</Badge>}
            </p>
          )}
        </div>
        {url && book && (
          <div className="flex flex-wrap gap-2">
            <SessionDialog date={ymd(new Date())} defaultKind="leitura">
              <Button size="sm"><BookOpen /> Registrar leitura</Button>
            </SessionDialog>
            <Button asChild size="sm" variant="outline">
              <a href={url} target="_blank" rel="noopener"><ExternalLink /> Nova aba</a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={url} download={book.fileName}><Download /> Baixar</a>
            </Button>
          </div>
        )}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border bg-card shadow-card">
        {meta.isError || error ? (
          <div className="p-6">
            <Empty>{error ?? "Este livro não foi encontrado ou foi removido da biblioteca."}</Empty>
          </div>
        ) : url ? (
          <iframe title={book?.title ?? "PDF"} src={url} className="size-full bg-muted" />
        ) : (
          <div className="grid size-full place-items-center p-6">
            <div className="w-full max-w-xs space-y-3 text-center">
              <FileText className="mx-auto size-10 animate-pulse text-primary" />
              <p className="eyebrow text-muted-foreground">Carregando o PDF…</p>
              <Progress value={progress} />
              <p className="tabular text-xs text-muted-foreground">{Math.round(progress)}%</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
