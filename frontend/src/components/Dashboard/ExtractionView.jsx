import React, { useState, useRef } from 'react';
import { Upload, FileImage, CheckCircle, Loader, Trash2 } from 'lucide-react';
import { extractDocument } from '../../services/dataService';

const ExtractionView = ({ showToast }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
  const MAX_SIZE_MB = 5;

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!ALLOWED_TYPES.includes(selected.type)) {
      setError('Only PNG, JPG, and JPEG images are supported.');
      return;
    }
    if (selected.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File size must be under ${MAX_SIZE_MB} MB.`);
      return;
    }

    setFile(selected);
    setResult(null);
    setError('');
    setPreview(URL.createObjectURL(selected));
    // Reset input to allow re-selecting the same file
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      // Simulate an onChange event
      const dt = new DataTransfer();
      dt.items.add(dropped);
      const syntheticEvent = { target: { files: dt.files, value: '' } };
      handleFileChange(syntheticEvent);
    }
  };

  const handleClear = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExtract = async () => {
    if (!file) { setError('Please select an image first.'); return; }

    setLoading(true);
    setError('');

    try {
      const res = await extractDocument(file);
      if (res?.extracted_data) {
        setResult(res.extracted_data);
        showToast?.('Data extracted successfully!', 'success');
      } else {
        setError('Extraction returned no data. Please try another image.');
      }
    } catch (err) {
      const msg = err.message || 'Extraction failed. Please try again.';
      setError(msg);
      showToast?.(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderResultField = (key, value) => {
    if (typeof value === 'object' && value !== null) {
      return (
        <div key={key} style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{key}</p>
          <div style={{ paddingLeft: '12px', borderLeft: '2px solid #E5E7EB' }}>
            {Object.entries(value).map(([k, v]) => renderResultField(k, v))}
          </div>
        </div>
      );
    }
    return (
      <div key={key} style={{ display: 'flex', gap: '12px', marginBottom: '10px', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'capitalize', minWidth: '120px', paddingTop: '1px' }}>{key.replace(/_/g, ' ')}</span>
        <span style={{ fontSize: '13px', color: '#111827', flex: 1, wordBreak: 'break-word' }}>{String(value)}</span>
      </div>
    );
  };

  return (
    <div className="dashboard-content" style={{ padding: '30px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '6px' }}>AI Document Extraction</h3>
        <p style={{ color: '#6B7280', fontSize: '13px' }}>
          Upload a clear image of your document (invoice, contract, ID, etc.) and our AI will extract structured data automatically.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Upload Panel */}
        <div style={{ flex: '1 1 380px', minWidth: '300px' }}>
          {/* Drop Zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => !file && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${file ? '#6C2BD9' : '#D1D5DB'}`,
              borderRadius: '16px',
              padding: '32px 20px',
              textAlign: 'center',
              backgroundColor: file ? '#F5F3FF' : '#F9FAFB',
              marginBottom: '16px',
              cursor: file ? 'default' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {file && preview ? (
              <div>
                <img src={preview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', objectFit: 'contain', marginBottom: '12px' }} />
                <p style={{ fontWeight: '500', color: '#374151', fontSize: '13px', marginBottom: '4px' }}>{file.name}</p>
                <p style={{ fontSize: '11px', color: '#9CA3AF' }}>{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <>
                <div style={{ width: '56px', height: '56px', background: '#EDE9FE', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <FileImage size={28} color="#6C2BD9" />
                </div>
                <p style={{ fontWeight: '600', color: '#374151', marginBottom: '6px', fontSize: '14px' }}>
                  Drop your document here
                </p>
                <p style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '16px' }}>
                  or click to browse — PNG, JPG (max {MAX_SIZE_MB} MB)
                </p>
                <span style={{ display: 'inline-block', padding: '9px 20px', backgroundColor: '#6C2BD9', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                  Select File
                </span>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            id="fileUpload"
            accept="image/png,image/jpeg,image/jpg"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {/* File controls */}
          {file && (
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ flex: 1, padding: '9px', border: '1.5px solid #6C2BD9', background: 'white', color: '#6C2BD9', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Upload size={14} /> Change File
              </button>
              <button
                onClick={handleClear}
                style={{ padding: '9px 14px', border: '1.5px solid #E5E7EB', background: 'white', color: '#9CA3AF', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#DC2626' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleExtract}
            disabled={!file || loading}
            style={{
              width: '100%',
              padding: '13px',
              backgroundColor: file && !loading ? '#6C2BD9' : '#E5E7EB',
              color: file && !loading ? 'white' : '#9CA3AF',
              borderRadius: '10px',
              fontWeight: '700',
              fontSize: '14px',
              border: 'none',
              cursor: file && !loading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            {loading
              ? <><Loader size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Analyzing with AI…</>
              : 'Extract Data'
            }
          </button>
        </div>

        {/* Results Panel */}
        <div style={{ flex: '1 1 380px', minWidth: '300px' }}>
          <div style={{ padding: '24px', backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '16px', minHeight: '420px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: 0 }}>Extraction Results</h4>
              {result && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#10B981', fontWeight: '600', background: '#D1FAE5', padding: '3px 8px', borderRadius: '20px' }}>
                  <CheckCircle size={12} /> Success
                </span>
              )}
            </div>

            {!result && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#9CA3AF', gap: '12px' }}>
                <FileImage size={40} style={{ opacity: 0.3 }} />
                <p style={{ fontSize: '13px', textAlign: 'center', margin: 0 }}>
                  Upload a document and click "Extract Data" to see results here.
                </p>
              </div>
            )}

            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '16px' }}>
                <Loader size={36} color="#6C2BD9" style={{ animation: 'spin 0.8s linear infinite' }} />
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontWeight: '600', color: '#374151', margin: '0 0 4px' }}>Analyzing your document…</p>
                  <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>This may take a few seconds</p>
                </div>
              </div>
            )}

            {result && !loading && (
              <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
                {typeof result === 'object'
                  ? Object.entries(result).map(([k, v]) => renderResultField(k, v))
                  : <pre style={{ fontSize: '12px', color: '#374151', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>{JSON.stringify(result, null, 2)}</pre>
                }
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default ExtractionView;
