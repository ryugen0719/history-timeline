import type { EventImageItem, EventImagesMap } from '../types/timeline';

export function isValidEventImageUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(trimmed)) {
    return true;
  }
  if (trimmed.startsWith('/')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function createEventImageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `img_${crypto.randomUUID()}`;
  }
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function addEventImage(
  map: EventImagesMap,
  eventId: string,
  payload: { url: string; caption?: string; id?: string }
): EventImagesMap {
  const url = payload.url.trim();
  if (!eventId || !isValidEventImageUrl(url)) return map;

  const caption = payload.caption?.trim() || undefined;
  const newItem: EventImageItem = {
    id: payload.id || createEventImageId(),
    url,
    caption,
  };

  const existing = map[eventId] ?? [];
  return {
    ...map,
    [eventId]: [...existing, newItem],
  };
}

export function updateEventImage(
  map: EventImagesMap,
  eventId: string,
  imageId: string,
  payload: { url: string; caption?: string }
): EventImagesMap {
  const url = payload.url.trim();
  if (!eventId || !imageId || !isValidEventImageUrl(url)) return map;

  const existing = map[eventId];
  if (!existing || existing.length === 0) return map;

  let changed = false;
  const caption = payload.caption?.trim() || undefined;
  const updated = existing.map((item) => {
    if (item.id !== imageId) return item;
    changed = true;
    return {
      ...item,
      url,
      caption,
    };
  });

  if (!changed) return map;
  return {
    ...map,
    [eventId]: updated,
  };
}

export function removeEventImage(
  map: EventImagesMap,
  eventId: string,
  imageId: string
): EventImagesMap {
  const existing = map[eventId];
  if (!existing || existing.length === 0) return map;

  const remaining = existing.filter((item) => item.id !== imageId);
  if (remaining.length === existing.length) return map;

  if (remaining.length === 0) {
    const next = { ...map };
    delete next[eventId];
    return next;
  }

  return {
    ...map,
    [eventId]: remaining,
  };
}
