/**
 * A `blob:` URL for one document, fetched with the auth header, revoked when
 * the id changes or the caller unmounts.
 *
 * An `<img>`, `<video>` or `<iframe>` pointed at the API cannot send a token
 * and would 401 (`AuthenticatedMediaPreview` explains the history). A blob URL
 * is also same-origin, which is what lets Whiteboard draw an image into a
 * canvas and still export it.
 */
import { useEffect, useState } from 'react';

import { documentsService } from '../api/documents';
import { apiErrorMessage } from '../lib/apiError';

interface Loaded {
  id: number | null;
  url: string | null;
  error: string | null;
}

export function useBlobUrl(docId: number | null): { url: string | null; error: string | null } {
  const [loaded, setLoaded] = useState<Loaded>({ id: null, url: null, error: null });
  useEffect(() => {
    if (docId == null) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    documentsService
      .download(docId, { inline: true })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ id: docId, url: objectUrl, error: null });
      })
      .catch((err) => {
        if (!cancelled) setLoaded({ id: docId, url: null, error: apiErrorMessage(err, 'This file could not be loaded.') });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [docId]);
  // A result for a previous id is not an answer for this one.
  return loaded.id === docId ? { url: loaded.url, error: loaded.error } : { url: null, error: null };
}
