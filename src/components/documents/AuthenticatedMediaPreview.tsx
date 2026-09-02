import { useEffect, useState } from 'react';
import { documentsService, type Document } from '../../api/documents';
import { MediaPreview } from '../chat/MediaPreview';

interface Props {
  doc: Document;
  className?: string;
}

/**
 * Preview that **cannot** load without authorisation.
 *
 * `MediaPreview` previously used `<img src="/api/.../download/">` directly.
 * Browsers cannot set `Authorization` on an `<img>` request, so it always
 * 401'd and the server logged `GET /api/inference/documents/9/download/ 401`.
 *
 * This wrapper fetches via `apiClient` (which adds `Bearer` header) and
 * creates a `blob:` URL. No `?token=` is appended — the file is never
 * public. The backend `QueryParamJWTAuthentication` still accepts `?token=`
 * as a fallback for external consumers, but the UI never uses it.
 */
export function AuthenticatedMediaPreview({ doc, className }: Props) {
  const isImage = doc.file_type.includes('image');
  const isPdf = doc.file_type.includes('pdf');
  const type = isImage ? 'image' : isPdf ? 'pdf' : 'link';

  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isImage) return;
    let objectUrl: string | null = null;
    let cancelled = false;

    documentsService
      .download(doc.id)
      .then((blob) => {
        if (cancelled) return;
        // Only use blob if it looks like an image; otherwise keep placeholder.
        if (!blob.type || blob.type.startsWith('image/') || isImage) {
          objectUrl = URL.createObjectURL(blob);
          setBlobUrl(objectUrl);
        }
      })
      .catch(() => {
        // Keep placeholder on 401/404 — the download will have already 401'd
        // if the user is not authorised.
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc.id, isImage]);

  // For images we wait for the authenticated blob; for others we render icon.
  const url = isImage ? blobUrl ?? '' : '';

  // While the blob is loading show the same placeholder MediaPreview would,
  // but without trying an unauthenticated fetch.
  if (isImage && !blobUrl) {
    return (
      <MediaPreview
        url={url}
        type={type}
        title={doc.title}
        source={doc.filename}
        className={className}
      />
    );
  }

  return (
    <MediaPreview
      url={blobUrl ?? ''}
      type={type}
      title={doc.title}
      source={doc.filename}
      className={className}
    />
  );
}
