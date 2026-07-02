import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, Loader } from 'lucide-react';
import { apiFetch } from '../../services/api';

const ExtractionView = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError('');
    }
  };

  const handleExtract = async () => {
    if (!file) {
      setError('Please select a file first.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('document', file);

      const res = await apiFetch('/extract', {
        method: 'POST',
        body: formData,
      });

      if (res && res.extracted_data) {
        setResult(res.extracted_data);
      } else {
        setError('Failed to extract data.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred during extraction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-content" style={{ padding: '30px' }}>
      <h3 className="section-title" style={{ fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '20px' }}>AI Document Extraction</h3>
      <p style={{ color: '#4B5563', marginBottom: '30px' }}>Upload an image of a document (PNG, JPG) to extract structured data using Groq AI.</p>

      <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 400px' }}>
          <div 
            style={{
              border: '2px dashed #D1D5DB',
              borderRadius: '16px',
              padding: '40px 20px',
              textAlign: 'center',
              backgroundColor: '#F9FAFB',
              marginBottom: '20px'
            }}
          >
            <Upload size={40} style={{ color: '#9CA3AF', margin: '0 auto 16px' }} />
            <p style={{ fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Drag and drop or click to upload</p>
            <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '16px' }}>Supports PNG, JPG (Max 5MB)</p>
            
            <input 
              type="file" 
              id="fileUpload" 
              accept="image/png, image/jpeg, image/jpg"
              style={{ display: 'none' }} 
              onChange={handleFileChange}
            />
            <label 
              htmlFor="fileUpload"
              style={{
                display: 'inline-block',
                padding: '10px 20px',
                backgroundColor: '#6C2BD9',
                color: 'white',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Select File
            </label>
          </div>

          {file && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', backgroundColor: '#F3F4F6', borderRadius: '8px', marginBottom: '20px' }}>
              <FileText size={24} style={{ color: '#6C2BD9' }} />
              <span style={{ fontWeight: '500', color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
              <CheckCircle size={20} style={{ color: '#10B981' }} />
            </div>
          )}

          {error && <p style={{ color: '#EF4444', marginBottom: '16px', fontSize: '14px' }}>{error}</p>}

          <button 
            onClick={handleExtract}
            disabled={!file || loading}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: file && !loading ? '#6C2BD9' : '#D1D5DB',
              color: 'white',
              borderRadius: '8px',
              fontWeight: '600',
              border: 'none',
              cursor: file && !loading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            {loading ? <><Loader className="spin" size={18} /> Extracting Data...</> : 'Extract Data'}
          </button>
        </div>

        <div style={{ flex: '1 1 400px' }}>
          <div style={{ padding: '24px', backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '16px', minHeight: '400px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <h4 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '20px' }}>Extraction Results</h4>
            
            {!result && !loading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#9CA3AF' }}>
                Results will appear here after extraction.
              </div>
            )}

            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#6C2BD9' }}>
                <Loader className="spin" size={32} style={{ marginBottom: '16px' }} />
                <p>Analyzing document with Groq AI...</p>
              </div>
            )}

            {result && !loading && (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                <pre style={{ 
                  backgroundColor: '#F9FAFB', 
                  padding: '16px', 
                  borderRadius: '8px', 
                  fontSize: '13px', 
                  color: '#1F2937',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word'
                }}>
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default ExtractionView;
