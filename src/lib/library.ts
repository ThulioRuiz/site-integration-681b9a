/** Código compartilhado entre navegador e servidor para a biblioteca de PDFs. */

/** Tamanho de cada parte enviada/baixada (fica abaixo do limite de corpo das funções). */
export const PART_SIZE = 3 * 1024 * 1024;
/** Tamanho máximo de um PDF. */
export const MAX_PDF_BYTES = 150 * 1024 * 1024;

export interface LibraryBook {
  id: string;
  title: string;
  author: string;
  subject: string;
  exam: string;
  description: string;
  fileName: string;
  sizeBytes: number;
  parts: number;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
  canDelete: boolean;
}

export const fmtBytes = (b: number) =>
  b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

async function readError(res: Response) {
  try {
    const j = (await res.json()) as { error?: string };
    return j.error ?? `Erro ${res.status}`;
  } catch {
    return `Erro ${res.status}`;
  }
}

export async function listLibrary(): Promise<LibraryBook[]> {
  const res = await fetch("/api/biblioteca", { credentials: "same-origin" });
  if (!res.ok) throw new Error(await readError(res));
  return ((await res.json()) as { books: LibraryBook[] }).books;
}

export async function getLibraryBook(id: string): Promise<LibraryBook> {
  const res = await fetch(`/api/biblioteca/${encodeURIComponent(id)}`, { credentials: "same-origin" });
  if (!res.ok) throw new Error(await readError(res));
  return ((await res.json()) as { book: LibraryBook }).book;
}

export async function deleteLibraryBook(id: string) {
  const res = await fetch(`/api/biblioteca/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin" });
  if (!res.ok) throw new Error(await readError(res));
}

export interface UploadMeta {
  title: string;
  author: string;
  subject: string;
  exam: string;
  description: string;
}

/** Envia o PDF em partes e só publica o livro quando todas chegam. */
export async function uploadPdf(file: File, meta: UploadMeta, onProgress: (pct: number) => void): Promise<string> {
  const parts = Math.max(1, Math.ceil(file.size / PART_SIZE));
  const res = await fetch("/api/biblioteca", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...meta, fileName: file.name, sizeBytes: file.size, parts }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const { id } = (await res.json()) as { id: string };
  try {
    for (let n = 0; n < parts; n++) {
      const chunk = file.slice(n * PART_SIZE, Math.min(file.size, (n + 1) * PART_SIZE));
      let ok = false;
      for (let attempt = 0; attempt < 3 && !ok; attempt++) {
        const r = await fetch(`/api/biblioteca/${id}/parte/${n}`, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/octet-stream" },
          body: chunk,
        });
        if (r.ok) ok = true;
        else if (attempt === 2) throw new Error(await readError(r));
      }
      onProgress(((n + 1) / parts) * 100);
    }
    const fin = await fetch(`/api/biblioteca/${id}`, { method: "PATCH", credentials: "same-origin" });
    if (!fin.ok) throw new Error(await readError(fin));
    return id;
  } catch (e) {
    await deleteLibraryBook(id).catch(() => undefined);
    throw e;
  }
}

/** Baixa todas as partes e devolve um Blob PDF pronto para abrir no leitor. */
export async function downloadPdf(book: LibraryBook, onProgress: (pct: number) => void): Promise<Blob> {
  const chunks: ArrayBuffer[] = [];
  for (let n = 0; n < book.parts; n++) {
    const r = await fetch(`/api/biblioteca/${book.id}/parte/${n}`, { credentials: "same-origin" });
    if (!r.ok) throw new Error(await readError(r));
    chunks.push(await r.arrayBuffer());
    onProgress(((n + 1) / book.parts) * 100);
  }
  return new Blob(chunks, { type: "application/pdf" });
}
