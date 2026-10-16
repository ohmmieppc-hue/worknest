// Query-string helpers shared by the list pages (search, tabs, pagination).

export const PAGE_SIZE = 20;

export type SearchParams = Record<string, string | string[] | undefined>;

export interface ListParams {
  q: string;
  tab: string;
  page: number;
}

export function parseListParams(params: SearchParams): ListParams {
  const one = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const page = Number.parseInt(one("page"), 10);
  return { q: one("q").trim().slice(0, 100), tab: one("tab"), page: Number.isFinite(page) && page > 1 ? page : 1 };
}

/** [from, to] for supabase .range(), inclusive. */
export function pageRange(page: number): [number, number] {
  const from = (page - 1) * PAGE_SIZE;
  return [from, from + PAGE_SIZE - 1];
}

/** Builds "/path?tab=x&q=y&page=2", dropping empty values and page 1. */
export function listHref(path: string, params: Partial<ListParams> & Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || (key === "page" && Number(value) <= 1) || (key === "tab" && value === "all")) continue;
    qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

/** Strips characters that have meaning in PostgREST filter syntax. */
export function searchTerm(q: string) {
  return q.replace(/[,()*%\\"]/g, " ").replace(/\s+/g, " ").trim();
}
