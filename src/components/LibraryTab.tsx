import { useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { BookmarkPlus, BookOpenText, FileText, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/kit";
import { NativeSelect } from "@/components/NativeSelect";
import { ConfirmDelete } from "@/components/ConfirmDialog";
import { uid, useApp } from "@/lib/store";
import { deleteLibraryBook, fmtBytes, listLibrary, MAX_PDF_BYTES, uploadPdf, type LibraryBook } from "@/lib/library";
import { EXAMS, type ExamId } from "@/lib/types";

export const LIBRARY_QUERY = ["biblioteca"] as const;

export function LibraryTab() {
  const subjects = useApp((s) => s.subjects);
  const books = useApp((s) => s.books);
  const upsertBook = useApp((s) => s.upsertBook);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: LIBRARY_QUERY, queryFn: listLibrary });
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [exam, setExam] = useState("");
  const del = useMutation({
    mutationFn: deleteLibraryBook,
    onSuccess: () => {
      toast.success("PDF removido da biblioteca.");
      void qc.invalidateQueries({ queryKey: LIBRARY_QUERY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const norm = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const list = (q.data ?? [])
    .filter((b) => !subject || b.subject === subject)
    .filter((b) => !exam || b.exam === exam)
    .filter((b) => !search || norm(`${b.title} ${b.author} ${b.description}`).includes(norm(search)));
  const subjectNames = Array.from(new Set([...subjects.map((s) => s.name), ...(q.data ?? []).map((b) => b.subject).filter(Boolean)]));
  const inList = new Set(books.map((b) => b.libraryId).filter(Boolean));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-card">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <BookOpenText className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold">Biblioteca online do Quartel</p>
            <p className="text-sm text-muted-foreground">
              Envie PDFs (até {fmtBytes(MAX_PDF_BYTES)}) e leia direto no site, em qualquer aparelho.
            </p>
          </div>
        </div>
        <UploadDialog>
          <Button><Upload /> Enviar PDF</Button>
        </UploadDialog>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por título, autor…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <NativeSelect value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option value="">Todas as matérias</option>
          {subjectNames.map((s) => <option key={s} value={s}>{s}</option>)}
        </NativeSelect>
        <NativeSelect value={exam} onChange={(e) => setExam(e.target.value)}>
          <option value="">Todos os concursos</option>
          {EXAMS.map((e) => <option key={e} value={e}>{e}</option>)}
        </NativeSelect>
      </div>

      {q.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-44 animate-pulse rounded-xl border bg-muted/50" />)}
        </div>
      ) : q.isError ? (
        <Empty>
          Não foi possível carregar a biblioteca agora.{" "}
          <button className="font-semibold text-primary underline" onClick={() => void q.refetch()}>Tentar de novo</button>
        </Empty>
      ) : list.length === 0 ? (
        <Empty>{q.data?.length ? "Nenhum PDF com esse filtro." : "A biblioteca está vazia. Envie o primeiro PDF!"}</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((b) => (
            <LibraryCard
              key={b.id}
              book={b}
              inList={inList.has(b.id)}
              onSave={() => {
                const s = subjects.find((x) => x.name === b.subject);
                upsertBook({
                  id: uid(), title: b.title, author: b.author, subjectId: s?.id, status: "lendo",
                  pagesTotal: 0, pagesRead: 0, notes: "", exam: (EXAMS as string[]).includes(b.exam) ? (b.exam as ExamId) : undefined,
                  libraryId: b.id,
                });
                toast.success("Adicionado à sua lista de leitura.");
              }}
              onDelete={() => del.mutate(b.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LibraryCard({ book, inList, onSave, onDelete }: { book: LibraryBook; inList: boolean; onSave: () => void; onDelete: () => void }) {
  return (
    <article className="flex flex-col rounded-xl border bg-card p-4 shadow-card animate-rise">
      <div className="flex gap-3">
        <div className="bg-field grid h-20 w-14 shrink-0 place-items-center rounded-md text-primary-foreground shadow-lift">
          <FileText className="size-6 opacity-90" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-lg font-semibold leading-tight">{book.title}</h3>
          {book.author && <p className="truncate text-sm text-muted-foreground">{book.author}</p>}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {book.subject && <Badge variant="secondary">{book.subject}</Badge>}
            {book.exam && <Badge variant="outline">{book.exam}</Badge>}
          </div>
        </div>
      </div>
      {book.description && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{book.description}</p>}
      <p className="mt-3 text-xs text-muted-foreground">
        {fmtBytes(book.sizeBytes)} · enviado por {book.uploadedByName || "recruta"} em {format(parseISO(book.createdAt), "dd/MM/yy")}
      </p>
      <div className="mt-auto flex items-center gap-1 pt-3">
        <Button asChild size="sm" className="flex-1">
          <Link to="/leitor/$id" params={{ id: book.id }}><BookOpenText /> Abrir</Link>
        </Button>
        <Button size="icon" variant="outline" className="size-8" disabled={inList} aria-label="Salvar na minha lista" title={inList ? "Já está na sua lista" : "Salvar na minha lista"} onClick={onSave}>
          <BookmarkPlus />
        </Button>
        {book.canDelete && (
          <ConfirmDelete title="Remover este PDF?" description="O arquivo sai da biblioteca para todos os recrutas." confirmLabel="Remover" onConfirm={onDelete}>
            <Button size="icon" variant="ghost" className="size-8" aria-label="Remover PDF"><Trash2 /></Button>
          </ConfirmDelete>
        )}
      </div>
    </article>
  );
}

function UploadDialog({ children }: { children: ReactNode }) {
  const subjects = useApp((s) => s.subjects);
  const profileExam = useApp((s) => s.profile?.exam ?? "");
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [subject, setSubject] = useState("");
  const [exam, setExam] = useState<string>(profileExam);
  const [description, setDescription] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null); setTitle(""); setAuthor(""); setSubject(""); setDescription(""); setProgress(null); setError(null); setExam(profileExam);
    if (fileRef.current) fileRef.current.value = "";
  };

  const pick = (f: File | undefined) => {
    setError(null);
    if (!f) return setFile(null);
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return setError("Escolha um arquivo PDF.");
    if (f.size > MAX_PDF_BYTES) return setError(`O PDF passa de ${fmtBytes(MAX_PDF_BYTES)}.`);
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim());
  };

  const send = async () => {
    if (!file) return setError("Escolha um PDF.");
    if (!title.trim()) return setError("Dê um título ao livro.");
    setError(null);
    setProgress(0);
    try {
      await uploadPdf(file, { title: title.trim(), author: author.trim(), subject, exam, description: description.trim() }, setProgress);
      toast.success("PDF publicado na biblioteca!");
      await qc.invalidateQueries({ queryKey: LIBRARY_QUERY });
      setOpen(false);
      reset();
    } catch (e) {
      setProgress(null);
      setError(e instanceof Error ? e.message : "Falha no envio.");
    }
  };

  const busy = progress !== null;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) { setOpen(o); if (!o) reset(); } }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">Enviar PDF</DialogTitle>
          <DialogDescription>O livro fica guardado no site e qualquer recruta logado pode abrir e ler.</DialogDescription>
        </DialogHeader>
        <fieldset disabled={busy} className="grid gap-4">
          <label
            className="grid-paper flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition hover:border-primary"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
          >
            <Upload className="size-6 text-primary" />
            {file ? (
              <span className="text-sm"><b>{file.name}</b> · {fmtBytes(file.size)}</span>
            ) : (
              <span className="text-sm text-muted-foreground">Arraste o PDF aqui ou <b className="text-foreground">clique para escolher</b></span>
            )}
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          <div className="space-y-2"><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} /></div>
          <div className="space-y-2"><Label>Autor</Label><Input value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={200} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Matéria</Label>
              <NativeSelect value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="">—</option>
                {subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label>Concurso</Label>
              <NativeSelect value={exam} onChange={(e) => setExam(e.target.value)}>
                <option value="">Geral</option>
                {EXAMS.map((e) => <option key={e} value={e}>{e}</option>)}
              </NativeSelect>
            </div>
          </div>
          <div className="space-y-2"><Label>Descrição (opcional)</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} /></div>
        </fieldset>
        {busy && (
          <div className="space-y-1">
            <Progress value={progress ?? 0} />
            <p className="tabular text-xs text-muted-foreground">Enviando… {Math.round(progress ?? 0)}%</p>
          </div>
        )}
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
        <DialogFooter>
          <Button onClick={send} disabled={busy || !file}>{busy ? "Enviando…" : "Publicar na biblioteca"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
