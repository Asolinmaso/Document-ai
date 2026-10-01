import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import TemplateTextEditorView from './components/Dashboard/TemplateTextEditorView';
import EditorView from './components/Dashboard/EditorView';

const toDataUrl = async (url) => {
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  return `data:application/pdf;base64,${btoa(binary)}`;
};
window.__calls = [];
const log = (name) => (...args) => { window.__calls.push({ name, args }); };

const Harness = () => {
  const [doc, setDoc] = useState(null);
  const view = new URLSearchParams(window.location.search).get('view') || 'text';
  useEffect(() => { toDataUrl('/zz_tpl.pdf').then((file) => setDoc({ id: 1, name: 'quotation', type: 'Quotation', status: 'active', file, quotationData: {}, templateEdits: window.__templateEdits || null })); }, []);
  if (!doc) return <p>loading</p>;
  const save = async (id, data) => { window.__calls.push({ name: 'save', args: [id, data] }); const next = { ...doc, ...data }; setDoc(next); return next; };
  return (
    <div className="dashboard-layout"><div className="main-content">
      {view === 'text'
        ? <TemplateTextEditorView doc={doc} onBack={log('back')} onSave={(data) => save(doc.id, data)} showToast={log('toast')} />
        : <EditorView doc={doc} onBack={log('back')} onSaveQuotation={save} onCreateQuotation={log('create')} onEditTemplate={log('editTemplate')} showToast={log('toast')} />}
    </div></div>
  );
};
createRoot(document.getElementById('root')).render(<Harness />);
