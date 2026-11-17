import type { PersonProfilesMap } from '../types/timeline';

export interface WikiLookupEntry {
  photoUrl?: string;
  description?: string;
  enTitle?: string;
  pageTitle?: string;
}

export interface WikiPortraitResult {
  photoUrl: string;
  note?: string;
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function normalizeWikipediaLookupName(name: string): string {
  return name
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface MediaWikiQueryJson {
  query?: {
    normalized?: Array<{ from: string; to: string }>;
    redirects?: Array<{ from: string; to: string }>;
    pages?: Record<
      string,
      {
        pageid?: number;
        missing?: string;
        title?: string;
        thumbnail?: { source?: string };
        description?: string;
        langlinks?: Array<{ lang: string; '*': string }>;
      }
    >;
  };
}

/**
 * Parses a MediaWiki `action=query` response and maps results back to each original requested name,
 * resolving both `normalized` and `redirects` chains.
 */
export function parseMediaWikiQueryResponse(
  rawJson: unknown,
  requestedNames: string[]
): Map<string, WikiLookupEntry> {
  const result = new Map<string, WikiLookupEntry>();
  if (!rawJson || typeof rawJson !== 'object') return result;

  const data = rawJson as MediaWikiQueryJson;
  const query = data.query;
  if (!query || !query.pages) return result;

  const normMap = new Map<string, string>();
  for (const item of query.normalized ?? []) {
    normMap.set(item.from, item.to);
  }

  const redirectMap = new Map<string, string>();
  for (const item of query.redirects ?? []) {
    redirectMap.set(item.from, item.to);
  }

  const pageByTitle = new Map<string, WikiLookupEntry>();
  for (const page of Object.values(query.pages)) {
    if (!page || page.missing !== undefined || !page.title) continue;
    const enLink = page.langlinks?.find((l) => l.lang === 'en')?.['*'];
    pageByTitle.set(page.title, {
      photoUrl: page.thumbnail?.source,
      description: page.description?.trim() || undefined,
      enTitle: enLink?.trim() || undefined,
      pageTitle: page.title,
    });
  }

  for (const originalName of requestedNames) {
    const lookup = normalizeWikipediaLookupName(originalName);
    if (!lookup) continue;

    let resolved = normMap.get(lookup) ?? lookup;
    const visited = new Set<string>([resolved]);
    while (redirectMap.has(resolved)) {
      const next = redirectMap.get(resolved)!;
      if (visited.has(next)) break;
      visited.add(next);
      resolved = next;
    }

    const entry = pageByTitle.get(resolved);
    if (entry) {
      result.set(originalName, entry);
    }
  }

  return result;
}

/**
 * Merges fetched Wikipedia portraits into existing personProfiles without overwriting
 * manually registered photos or notes.
 */
export function mergeWikipediaPortraits(
  existing: PersonProfilesMap,
  fetched: Record<string, WikiPortraitResult>
): PersonProfilesMap {
  let changed = false;
  const next: PersonProfilesMap = { ...existing };

  for (const [name, item] of Object.entries(fetched)) {
    if (!item.photoUrl) continue;
    const prev = next[name];
    if (prev?.photoUrl) {
      // Preserve existing user-provided photo, only fill missing note if empty
      if (!prev.note && item.note) {
        next[name] = { ...prev, note: item.note };
        changed = true;
      }
      continue;
    }

    next[name] = {
      photoUrl: item.photoUrl,
      note: prev?.note || item.note || undefined,
    };
    changed = true;
  }

  return changed ? next : existing;
}

async function queryWikipediaTitles(
  lang: 'ja' | 'en',
  titles: string[],
  thumbSize = 320
): Promise<Map<string, WikiLookupEntry>> {
  const uniqueTitles = Array.from(
    new Set(titles.map(normalizeWikipediaLookupName).filter(Boolean))
  );
  const aggregated = new Map<string, WikiLookupEntry>();
  if (uniqueTitles.length === 0) return aggregated;

  const chunks = chunkArray(uniqueTitles, 40);
  for (const chunk of chunks) {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      redirects: '1',
      prop: lang === 'ja' ? 'pageimages|description|langlinks' : 'pageimages',
      piprop: 'thumbnail',
      pithumbsize: String(thumbSize),
      titles: chunk.join('|'),
    });
    if (lang === 'ja') {
      params.set('lllang', 'en');
    }

    const res = await fetch(
      `https://${lang}.wikipedia.org/w/api.php?${params.toString()}`
    );
    if (!res.ok) continue;
    const json: unknown = await res.json();
    const parsed = parseMediaWikiQueryResponse(json, chunk);
    for (const [key, val] of parsed.entries()) {
      aggregated.set(key, val);
    }
  }

  return aggregated;
}

async function searchWikipediaPortrait(
  name: string,
  thumbSize = 320
): Promise<WikiPortraitResult | null> {
  const normalized = normalizeWikipediaLookupName(name);
  if (!normalized) return null;

  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: normalized,
    gsrlimit: '1',
    prop: 'pageimages|description',
    piprop: 'thumbnail',
    pithumbsize: String(thumbSize),
  });

  const res = await fetch(
    `https://ja.wikipedia.org/w/api.php?${params.toString()}`
  );
  if (!res.ok) return null;
  const json = (await res.json()) as MediaWikiQueryJson;
  const pages = Object.values(json.query?.pages ?? {});
  const firstWithPhoto = pages.find((p) => Boolean(p.thumbnail?.source));
  if (!firstWithPhoto?.thumbnail?.source) return null;

  return {
    photoUrl: firstWithPhoto.thumbnail.source,
    note: firstWithPhoto.description?.trim() || undefined,
  };
}

/**
 * Fetches portrait URLs (and short biographical notes) from Wikipedia for a list of names.
 * Uses batched ja.wikipedia.org queries first, falls back to en.wikipedia.org via langlinks,
 * and finally tries a targeted Japanese search for unresolved spelling variations.
 */
export async function fetchWikipediaPortraitsBatch(
  names: string[]
): Promise<{
  portraits: Record<string, WikiPortraitResult>;
  completed: boolean;
}> {
  const uniqueNames = Array.from(
    new Set(names.map((n) => n.trim()).filter((n) => n && n !== '不明'))
  );
  if (uniqueNames.length === 0) {
    return { portraits: {}, completed: true };
  }

  const portraits: Record<string, WikiPortraitResult> = {};
  const lookupToOriginalNames = new Map<string, string[]>();
  for (const name of uniqueNames) {
    const lookup = normalizeWikipediaLookupName(name);
    if (!lookup) continue;
    const list = lookupToOriginalNames.get(lookup) ?? [];
    list.push(name);
    lookupToOriginalNames.set(lookup, list);
  }

  try {
    const jaResults = await queryWikipediaTitles(
      'ja',
      Array.from(lookupToOriginalNames.keys())
    );

    const pendingEnLookups: Array<{
      enTitle: string;
      originalNames: string[];
      jaNote?: string;
    }> = [];
    const unresolvedNames: string[] = [];

    for (const [lookup, originals] of lookupToOriginalNames.entries()) {
      const entry = jaResults.get(lookup);
      if (entry?.photoUrl) {
        for (const orig of originals) {
          portraits[orig] = {
            photoUrl: entry.photoUrl,
            note: entry.description,
          };
        }
      } else if (entry?.enTitle) {
        pendingEnLookups.push({
          enTitle: entry.enTitle,
          originalNames: originals,
          jaNote: entry.description,
        });
      } else {
        unresolvedNames.push(...originals);
      }
    }

    // Fallback 1: Batch query English Wikipedia via langlinks
    if (pendingEnLookups.length > 0) {
      const enResults = await queryWikipediaTitles(
        'en',
        pendingEnLookups.map((item) => item.enTitle)
      );
      for (const item of pendingEnLookups) {
        const enEntry = enResults.get(
          normalizeWikipediaLookupName(item.enTitle)
        );
        if (enEntry?.photoUrl) {
          for (const orig of item.originalNames) {
            portraits[orig] = {
              photoUrl: enEntry.photoUrl,
              note: item.jaNote,
            };
          }
        } else {
          unresolvedNames.push(...item.originalNames);
        }
      }
    }

    // Fallback 2: Targeted search for remaining names (capped to avoid burst)
    const searchCandidates = unresolvedNames.slice(0, 12);
    for (let i = 0; i < searchCandidates.length; i += 3) {
      const slice = searchCandidates.slice(i, i + 3);
      const found = await Promise.all(
        slice.map(async (orig) => ({
          orig,
          hit: await searchWikipediaPortrait(orig).catch(() => null),
        }))
      );
      for (const { orig, hit } of found) {
        if (hit) {
          portraits[orig] = hit;
        }
      }
    }

    return { portraits, completed: true };
  } catch {
    return { portraits, completed: false };
  }
}

export async function fetchSingleWikipediaPortrait(
  name: string
): Promise<WikiPortraitResult | null> {
  const { portraits } = await fetchWikipediaPortraitsBatch([name]);
  return portraits[name.trim()] ?? null;
}

export async function fetchWikipediaEventImage(
  title: string
): Promise<WikiPortraitResult | null> {
  const trimmed = title.trim();
  if (!trimmed) return null;
  try {
    const jaResults = await queryWikipediaTitles('ja', [trimmed], 640);
    const jaEntry = jaResults.get(trimmed);
    if (jaEntry?.photoUrl) {
      return {
        photoUrl: jaEntry.photoUrl,
        note: jaEntry.description,
      };
    }
    if (jaEntry?.enTitle) {
      const enResults = await queryWikipediaTitles('en', [jaEntry.enTitle], 640);
      const enEntry = enResults.get(
        normalizeWikipediaLookupName(jaEntry.enTitle)
      );
      if (enEntry?.photoUrl) {
        return {
          photoUrl: enEntry.photoUrl,
          note: jaEntry.description,
        };
      }
    }
    return await searchWikipediaPortrait(trimmed, 640);
  } catch {
    return null;
  }
}
