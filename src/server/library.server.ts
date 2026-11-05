import { getStore } from "@netlify/blobs";

/** Cada PDF é salvo em partes de até PART_SIZE bytes: `<id>/<n>`. */
export const libraryStore = () => getStore({ name: "biblioteca-pdfs", consistency: "strong" });

export const partKey = (id: string, n: number) => `${id}/${n}`;

export async function deleteBookParts(id: string, parts: number) {
  const store = libraryStore();
  await Promise.all(Array.from({ length: parts }, (_, n) => store.delete(partKey(id, n))));
}
