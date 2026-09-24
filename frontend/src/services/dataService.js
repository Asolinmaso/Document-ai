/**
 * Centralised API service layer.
 * All components should call these functions instead of using fetch/axios directly.
 */
import api from './api';

// ── Profile ──────────────────────────────────────────────────────────────────

export const fetchProfile = () => api.get('/profile');

export const updateProfile = (data) => api.put('/profile', data);

// ── Logos ─────────────────────────────────────────────────────────────────────

export const fetchLogos = () => api.get('/logos');

export const updateLogos = (logos) => api.post('/logos', logos);

// ── Documents ────────────────────────────────────────────────────────────────

export const fetchDocuments = () => api.get('/documents');

export const createDocument = (doc) => api.post('/documents', doc);

export const updateDocument = (id, data) => api.put(`/documents/${id}`, data);

export const deleteDocument = (id) => api.delete(`/documents/${id}`);

// ── Extraction ───────────────────────────────────────────────────────────────

export const extractDocument = (file, docId) => {
  const formData = new FormData();
  formData.append('document', file);
  if (docId) formData.append('docId', docId);
  return api.post('/extract', formData);
};

// ── Mail ─────────────────────────────────────────────────────────────────────

export const fetchMail = () => api.get('/mail');

export const saveMail = (mail) => api.post('/mail', mail);

export const updateMailFolder = (id, folder) => api.put(`/mail/${id}`, { folder });

export const deleteMail = (id) => api.delete(`/mail/${id}`);

export const syncMail = () => api.get('/mail/sync');

export const sendMail = (payload) => api.post('/mail/send', payload);
