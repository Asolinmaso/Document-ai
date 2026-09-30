import { formatRelativeTime, formatShortDate } from './time';

export const STATUS_META = {
  draft: { label: 'Draft', bg: '#FEF3C7', color: '#92400E' },
  active: { label: 'Final', bg: '#DCFCE7', color: '#166534' },
  sent: { label: 'Sent', bg: '#DBEAFE', color: '#1E40AF' },
};

export const statusMeta = (status) => STATUS_META[status] || STATUS_META.active;

/** Anything that is neither trashed nor an unfinished draft. */
export const isLiveDoc = (d) => d.status !== 'trash' && d.status !== 'draft';

export const isQuotationDoc = (d) => d.type === 'Quotation' || d.name?.toLowerCase().includes('quotation');

/** Document ids are Date.now() at creation, which stands in for rows saved before timestamps existed. */
const idToTime = (doc) => {
  const n = Number(doc?.id);
  return Number.isFinite(n) && n > 1e12 ? n : null;
};

export const createdAtOf = (doc) => doc?.createdAt || idToTime(doc);
export const updatedAtOf = (doc) => doc?.updatedAt || createdAtOf(doc);

/** "Just now" / "5 minutes ago" / … for the "Edited" column; `now` lets a ticking clock re-render it. */
export const lastUpdatedLabel = (doc, now) => formatRelativeTime(updatedAtOf(doc), now) || doc?.edited || '—';

export const createdLabel = (doc) => formatShortDate(createdAtOf(doc)) || '—';

/** Client shown in lists: the saved Company Name, falling back to the "To" recipient. */
export const companyOf = (doc) => doc?.quotationData?.companyName || doc?.quotationData?.recipient || '';

export const safeFileName = (name, fallback = 'quotation') =>
  (name || fallback).trim().replace(/[^a-z0-9\-_ ]+/gi, '').replace(/\s+/g, '_') || fallback;

/** data: URL (or bare base64) → Blob */
export const dataUrlToPdfBlob = (dataUrl) => {
  const binary = atob(dataUrl.split(',')[1] || dataUrl);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: 'application/pdf' });
};

export const downloadPdf = (dataUrl, name) => {
  const url = URL.createObjectURL(dataUrlToPdfBlob(dataUrl));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFileName(name)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
