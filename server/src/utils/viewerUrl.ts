import { env } from '../config/env';

/**
 * Resolves the browser-facing base URL for OHIF Viewer.
 *
 * In development or test environments, defaults to http://localhost:3002.
 * In production environments, avoids leaking loopback URLs (localhost / 127.0.0.1)
 * to client browsers, resolving instead to the configured public domain, CORS_ORIGIN,
 * or same-origin relative path.
 */
export function getOhifViewerBaseUrl(): string {
  const isProd = process.env.NODE_ENV === 'production' || env.NODE_ENV === 'production';
  const corsOrigin = (process.env.CORS_ORIGIN || env.CORS_ORIGIN || '').trim();
  const customUrl = (process.env.OHIF_VIEWER_URL || process.env.OHIF_BASE_URL || env.OHIF_BASE_URL || '').trim();
  const isLoopback = !customUrl || customUrl.includes('localhost') || customUrl.includes('127.0.0.1');

  if (isProd) {
    // If explicitly configured with a non-localhost URL (e.g. http://meril-ris.mangesh.my.id), use it
    if (customUrl && !isLoopback) {
      return customUrl.replace(/\/+$/, '');
    }
    // If CORS_ORIGIN is a public domain, use it as the browser-facing base
    if (corsOrigin && !corsOrigin.includes('localhost') && !corsOrigin.includes('127.0.0.1')) {
      return corsOrigin.replace(/\/+$/, '');
    }
    // Fall back to same-origin relative URL (starts with /viewer)
    return '';
  }

  // Development & Test environments
  return (customUrl || 'http://localhost:3002').replace(/\/+$/, '');
}

/**
 * Builds a validated, URL-encoded OHIF study viewer launch URL.
 */
export function buildStudyViewerUrl(studyInstanceUid: string, priorStudyInstanceUid?: string): string {
  const base = getOhifViewerBaseUrl();
  const uids = priorStudyInstanceUid
    ? `${encodeURIComponent(studyInstanceUid)},${encodeURIComponent(priorStudyInstanceUid)}`
    : encodeURIComponent(studyInstanceUid);

  return `${base}/viewer?StudyInstanceUIDs=${uids}`;
}
