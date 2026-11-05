import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { BookmarkPlus, BookOpenText, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bar, Dot, Empty, PageHeader, Panel } from "@/components/kit";
import { NativeSelect } from "@/components/NativeSelect";
import { ConfirmDelete } from "@/components/ConfirmDialog";
import { LibraryTab } from "@/components/LibraryTab";
import { Link } from "@tanstack/react-router";
import { uid, useApp, useSubjectMap } from "@/lib/store";
import { suggestBooks } from "@/lib/books";
import { ymd } from "@/lib/calc";
import { BOOK_STATUS_LABEL } from "@/lib/labels";
import { EXAMS, type Book, type BookStatus, type ExamId } from "@/lib/types";

export const Route = createFileRoute("/livros")({
  head: () => ({
    meta: [
      { title: "Livros, biblioteca de PDFs e recomendações — Quartel de Estudos" },
      { name: "description", content: "Sua lista de leitura e livros sugeridos por matéria para ITA, IME, EFOMM e EsPCEx." },
      { property: "og:title", content: "Livros e recomendações — Quartel de Estudos" },
      { property: "og:description", content: "Lista de leitura e livros sugeridos por matéria e concurso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LivrosPage,
});

const pct = (b: Book) => (b.pagesTotal > 0 ? Math.min(100, (b.pagesRead / b.pagesTotal) * 100) : b.status === "concluido" ? 100 : 0);

function LivrosPage() {
  const books = useApp((s) => s.books);
  const subjects = useApp((s) => s.subjects);
  const profile = useApp((s) => s.profile)!;
  const { upsertBook, removeBook } = useApp.getState();
  const subj = useSubjectMap();
  const [status, setStatus] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [exam, setExam] = useState("");
  const [sugExam, setSugExam] = useState<ExamId>(profile.exam);
  const [sugSubject, setSugSubject] = useState("");

  const list = books
    .filter((b) => !status || b.status === status)
    .filter((b) => !subjectId || b.subjectId === subjectId)
    .filter((b) => !exam || b.exam === exam);
  const done = books.filter((b) => b.status === "concluido").sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""));
  const suggestions = useMemo(() => suggestBooks(sugExam, subjects, books, sugSubject || undefined), [sugExam, subjects, books, sugSubject]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Biblioteca" title="Livros">
        <BookDialog><Button><Plus /> Adicionar livro</Button></BookDialog>
      </PageHeader>
      <Tabs defaultValue="biblioteca">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="biblioteca">Biblioteca online</TabsTrigger>
          <TabsTrigger value="lista">Minha lista ({books.length})</TabsTrigger>
          <TabsTrigger value="sugestoes">Sugestões</TabsTrigger>
          <TabsTrigger value="concluidos">Concluídos ({done.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="biblioteca">
          <LibraryTab />
        </TabsContent>

        <TabsContent value="lista">
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos os status</option>
              {(Object.keys(BOOK_STATUS_LABEL) as BookStatus[]).map((s) => <option key={s} value={s}>{BOOK_STATUS_LABEL[s]}</option>)}
            </NativeSelect>
            <NativeSelect value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Todas as matérias</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </NativeSelect>
            <NativeSelect value={exam} onChange={(e) => setExam(e.target.value)}>
              <option value="">Todos os concursos</option>
              {EXAMS.map((e) => <option key={e} value={e}>{e}</option>)}
            </NativeSelect>
          </div>
          {list.length === 0 ? <Empty>Nenhum livro. Veja as sugestões para o {profile.exam}.</Empty> : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((b) => (
                <Panel key={b.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-xl font-semibold leading-tight">{b.title}</h3>
                      <p className="text-sm text-muted-foreground">{b.author}</p>
                    </div>
                    <Badge variant="outline">{BOOK_STATUS_LABEL[b.status]}</Badge>
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {b.subjectId && subj[b.subjectId] && <><Dot color={subj[b.subjectId]!.color} />{subj[b.subjectId]!.name} · </>}
                    {b.exam ?? "Geral"}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Bar value={pct(b)} />
                    <span className="tabular w-24 text-right text-xs">{b.pagesTotal > 0 ? `${b.pagesRead}/${b.pagesTotal} p.` : `${Math.round(pct(b))}%`}</span>
                  </div>
                  {b.notes && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{b.notes}</p>}
                  <div className="mt-3 flex justify-end">
                    {b.libraryId && (
                      <Button asChild size="sm" variant="outline" className="mr-auto">
                        <Link to="/leitor/$id" params={{ id: b.libraryId }}><BookOpenText /> Ler PDF</Link>
                      </Button>
                    )}
                    <BookDialog book={b}><Button size="icon" variant="ghost" aria-label="Editar"><Pencil /></Button></BookDialog>
                    <ConfirmDelete title="Excluir livro?" onConfirm={() => removeBook(b.id)}>
                      <Button size="icon" variant="ghost" aria-label="Excluir"><Trash2 /></Button>
                    </ConfirmDelete>
                  </div>
                </Panel>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sugestoes">
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            <NativeSelect value={sugExam} onChange={(e) => setSugExam(e.target.value as ExamId)}>
              {EXAMS.map((e) => <option key={e} value={e}>{e}</option>)}
            </NativeSelect>
            <NativeSelect value={sugSubject} onChange={(e) => setSugSubject(e.target.value)}>
              <option value="">Todas as matérias</option>
              {subjects.filter((s) => !s.archived).map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </NativeSelect>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">Ordenadas pela dificuldade das suas matérias: matérias difíceis priorizam livros aprofundados.</p>
          {suggestions.length === 0 ? <Empty>Sem novas sugestões para esse filtro.</Empty> : (
            <div className="grid gap-3 sm:grid-cols-2">
              {suggestions.map(({ book, subject }) => (
                <div key={book.title} className="flex gap-3 rounded-xl border bg-card p-4 shadow-card">
                  <div className="w-1 shrink-0 rounded-full" style={{ background: subject.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="eyebrow text-muted-foreground">{book.subject} · {["", "Base", "Intermediário", "Aprofundado"][book.level]}</p>
                    <h3 className="text-lg font-semibold leading-tight">{book.title}</h3>
                    <p className="text-sm text-muted-foreground">{book.author}</p>
                    <p className="mt-1 text-sm">{book.why}</p>
                  </div>
                  <Button size="icon" variant="outline" aria-label="Salvar na lista"
                    onClick={() => {
                      upsertBook({ id: uid(), title: book.title, author: book.author, subjectId: subject.id, status: "quero", pagesTotal: 0, pagesRead: 0, notes: "", exam: sugExam });
                      toast.success("Livro adicionado à sua lista.");
                    }}>
                    <BookmarkPlus />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="concluidos">
          {done.length === 0 ? <Empty>Nenhum livro concluído ainda.</Empty> : (
            <ul className="divide-y rounded-xl border bg-card">
              {done.map((b) => (
                <li key={b.id} className="flex items-center gap-3 p-3 text-sm">
                  <span className="tabular w-20 text-xs text-muted-foreground">{b.finishedAt ? format(parseISO(b.finishedAt), "dd/MM/yy") : "—"}</span>
                  <span className="flex-1 font-medium">{b.title}</span>
                  <span className="text-muted-foreground">{b.author}</span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BookDialog({ book, children }: { book?: Book; children: ReactNode }) {
  const subjects = useApp((s) => s.subjects);
  const profile = useApp((s) => s.profile)!;
  const upsertBook = useApp((s) => s.upsertBook);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Book>({ id: "", title: "", author: "", status: "quero", pagesTotal: 0, pagesRead: 0, notes: "" });
  useEffect(() => {
    if (open) setF(book ?? { id: uid(), title: "", author: "", status: "quero", pagesTotal: 0, pagesRead: 0, notes: "", exam: profile.exam });
  }, [open, book, profile.exam]);
  const save = () => {
    if (!f.title.trim()) {
      toast.error("Informe o título.");
      return;
    }
    const finished = f.status === "concluido" ? f.finishedAt ?? ymd(new Date()) : undefined;
    upsertBook({ ...f, title: f.title.trim(), finishedAt: finished });
    toast.success("Livro salvo.");
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display text-2xl uppercase">{book ? "Editar livro" : "Novo livro"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2"><Label>Título</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="space-y-2"><Label>Autor</Label><Input value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <NativeSelect value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as BookStatus })}>
                {(Object.keys(BOOK_STATUS_LABEL) as BookStatus[]).map((s) => <option key={s} value={s}>{BOOK_STATUS_LABEL[s]}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label>Matéria</Label>
              <NativeSelect value={f.subjectId ?? ""} onChange={(e) => setF({ ...f, subjectId: e.target.value || undefined })}>
                <option value="">—</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label>Concurso</Label>
              <NativeSelect value={f.exam ?? ""} onChange={(e) => setF({ ...f, exam: (e.target.value || undefined) as ExamId | undefined })}>
                <option value="">Geral</option>
                {EXAMS.map((e) => <option key={e} value={e}>{e}</option>)}
              </NativeSelect>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Páginas lidas</Label><Input type="number" min={0} value={f.pagesRead} onChange={(e) => setF({ ...f, pagesRead: Math.max(0, Number(e.target.value)) })} /></div>
            <div className="space-y-2"><Label>Total de páginas</Label><Input type="number" min={0} value={f.pagesTotal} onChange={(e) => setF({ ...f, pagesTotal: Math.max(0, Number(e.target.value)) })} /></div>
          </div>
          <div className="space-y-2"><Label>Anotações</Label><Textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
