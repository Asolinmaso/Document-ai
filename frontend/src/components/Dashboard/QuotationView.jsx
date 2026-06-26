import React, { useState } from 'react';
import { 
  ArrowLeft,
  FileText,
  Trash2,
  Edit,
  X
} from 'lucide-react';

const SolidDocIcon = ({ color, size = 'sm' }) => {
  const width = size === 'sm' ? '30px' : '40px';
  const height = size === 'sm' ? '38px' : '50px';
  return (
    <div style={{ 
      width, 
      height, 
      background: color, 
      borderRadius: '4px', 
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: `0 4px 10px ${color}20`
    }}>
      <div style={{ 
        position: 'absolute', 
        top: 0, 
        right: 0, 
        width: '10px', 
        height: '10px', 
        background: 'rgba(255,255,255,0.4)', 
        borderBottomLeftRadius: '3px' 
      }}></div>
      <div style={{ width: '50%', height: '2px', background: 'rgba(255,255,255,0.6)', position: 'absolute', top: '30%' }}></div>
      <div style={{ width: '50%', height: '2px', background: 'rgba(255,255,255,0.6)', position: 'absolute', top: '45%' }}></div>
      <div style={{ width: '30%', height: '2px', background: 'rgba(255,255,255,0.6)', position: 'absolute', top: '60%', left: '25%' }}></div>
    </div>
  );
};

const CreateQuotationModal = ({ isOpen, onClose, onSelect, onCreateNew, latestDoc }) => {
  if (!isOpen) return null;

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      background: 'rgba(0, 0, 0, 0.4)', 
      backdropFilter: 'blur(6px)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{ 
        background: 'white', 
        borderRadius: '24px', 
        width: '100%', 
        maxWidth: '680px', 
        padding: '40px', 
        position: 'relative',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)'
      }}>
        <button 
          onClick={onClose}
          style={{ 
            position: 'absolute', 
            top: '24px', 
            right: '24px', 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer', 
            color: '#6B7280',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={24} />
        </button>

        <div style={{ marginBottom: '35px' }}>
          <h2 style={{ fontSize: '26px', fontWeight: '700', color: '#111827', margin: '0 0 10px 0' }}>Create Quotation</h2>
          <p style={{ color: '#6B7280', margin: 0, fontSize: '15px' }}>How would you like to create your quotation?</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
          {/* Use Previous Template */}
          <div 
            onClick={onSelect}
            style={{ 
              background: '#F3F4F6', 
              borderRadius: '20px', 
              padding: '28px', 
              display: 'flex', 
              flexDirection: 'column',
              position: 'relative',
              cursor: 'pointer',
              border: '2px solid transparent',
              transition: 'all 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = '#6C2BD9'}
            onMouseOut={e => e.currentTarget.style.borderColor = 'transparent'}
          >
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: '0 0 10px 0' }}>Use Previous Template</h3>
            <p style={{ fontSize: '13px', color: '#4B5563', margin: '0 0 24px 0', lineHeight: '1.6' }}>
              Choose from your existing quotation template and create faster.
            </p>
            
            <div style={{ 
              background: 'white', 
              borderRadius: '14px', 
              padding: '14px', 
              border: '1px solid #E5E7EB',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px'
            }}>
              <div style={{ background: '#6C2BD9', borderRadius: '6px', padding: '8px', color: 'white', display: 'flex' }}>
                <FileText size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#111827', margin: 0 }}>{latestDoc ? latestDoc.name : 'No Previous Template'}</p>
                <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>{latestDoc ? `Modified ${latestDoc.edited}` : 'Create your first template'}</p>
              </div>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2px solid #6C2BD9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6C2BD9' }}></div>
              </div>
            </div>

            <button style={{ 
              marginTop: 'auto', 
              background: 'none', 
              border: 'none', 
              color: '#6C2BD9', 
              fontSize: '13px', 
              fontWeight: '600', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: 0
            }}>
              Choose another template <span style={{ fontSize: '16px' }}>›</span>
            </button>
          </div>

          {/* Create New Template */}
          <div 
            onClick={onCreateNew}
            style={{ 
              background: '#F3F4F6', 
              borderRadius: '20px', 
              padding: '28px', 
              display: 'flex', 
              flexDirection: 'column',
              cursor: 'pointer',
              border: '2px solid transparent',
              transition: 'all 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = '#6C2BD9'}
            onMouseOut={e => e.currentTarget.style.borderColor = 'transparent'}
          >
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: '0 0 10px 0' }}>Create New Template</h3>
            <p style={{ fontSize: '13px', color: '#4B5563', margin: '0 0 24px 0', lineHeight: '1.6' }}>
              Start from scratch and create a new template for future use.
            </p>
            
            <div style={{ 
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '24px'
            }}>
              <div style={{ 
                width: '70px', 
                height: '90px', 
                background: '#6C2BD9', 
                borderRadius: '8px', 
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 12px 20px -5px rgba(108, 43, 217, 0.3)'
              }}>
                <FileText size={40} />
                <div style={{ 
                  position: 'absolute', 
                  bottom: '-10px', 
                  right: '-10px', 
                  width: '30px', 
                  height: '30px', 
                  background: 'white', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: '#6C2BD9',
                  boxShadow: '0 4px 10px rgba(0, 0, 0, 0.12)',
                  border: '1.5px solid #F3F4F6'
                }}>
                  <span style={{ fontSize: '22px', fontWeight: '700', lineHeight: 1 }}>+</span>
                </div>
              </div>
            </div>

            <button style={{ 
              marginTop: 'auto', 
              background: 'none', 
              border: 'none', 
              color: '#6C2BD9', 
              fontSize: '13px', 
              fontWeight: '600', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: 0
            }}>
              Create New template <span style={{ fontSize: '16px' }}>›</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const QuotationView = ({ onBack, onSelectTemplate, onCreateNewTemplate, docs = [] }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const types = [
    { name: 'Recruitment', color: '#6C2BD9' },
    { name: 'Technology', color: '#EF4444' },
    { name: 'Multimedia', color: '#22C55E' },
    { name: 'Digital Marketing', color: '#3B82F6' },
  ];

  // Get the most recent document for the modal preview
  const latestDoc = docs.length > 0 ? docs[0] : null;

  return (
    <div className="dashboard-content" style={{ padding: '30px' }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '20px' }}>
        Document &gt; Quotation
      </div>

      {/* Header with Back Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '35px' }}>
        <div 
          onClick={onBack}
          style={{ 
            width: '32px', 
            height: '32px', 
            background: '#6C2BD9', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: 'white', 
            cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(108, 43, 217, 0.3)'
          }}
        >
          <ArrowLeft size={18} />
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>Select Quotation Type</h2>
      </div>

      {/* Quotation Types Grid */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', borderBottom: '1.5px solid #111827', paddingBottom: '30px' }}>
        {types.map((type, i) => (
          <div 
            key={i} 
            className="action-card"
            onClick={() => setIsModalOpen(true)}
            style={{ 
              minWidth: '130px',
              maxWidth: '180px',
              flex: '1',
              background: '#FFFFFF', 
              border: 'none', 
              boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
              borderRadius: '16px',
              padding: '20px 10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              cursor: 'pointer',
              border: '1px solid #F3F4F6'
            }}
          >
            <SolidDocIcon color={type.color} size="sm" />
            <p style={{ fontWeight: '700', color: '#111827', fontSize: '13px', margin: 0 }}>{type.name}</p>
          </div>
        ))}
      </div>

      {/* Recent Documents Section */}
      <div>
        <h3 className="section-title" style={{ fontSize: '20px', fontWeight: '700', marginBottom: '25px', color: '#111827' }}>Recent Documents ({docs.length})</h3>
        <div style={{ background: 'transparent' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1.5px solid #111827' }}>
                <th style={{ padding: '12px 0', fontSize: '13px', color: '#111827', fontWeight: '700' }}>Name</th>
                <th style={{ padding: '12px 0', fontSize: '13px', color: '#111827', fontWeight: '700' }}>Type</th>
                <th style={{ padding: '12px 0', fontSize: '13px', color: '#111827', fontWeight: '700' }}>Edited</th>
                <th style={{ padding: '12px 0', fontSize: '13px', color: '#111827', fontWeight: '700', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc, i) => (
                <tr key={i} style={{ borderBottom: i === docs.length - 1 ? 'none' : '1px solid #111827', cursor: 'pointer' }} onClick={() => onSelectTemplate()}>
                  <td style={{ padding: '20px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: '#6C2BD9', color: 'white', borderRadius: '4px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <FileText size={16} />
                      </div>
                      <span style={{ fontWeight: '500', color: '#111827', fontSize: '14px' }}>{doc.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '20px 0', color: '#4B5563', fontSize: '14px' }}>{doc.type}</td>
                  <td style={{ padding: '20px 0', color: '#4B5563', fontSize: '14px' }}>{doc.edited}</td>
                  <td style={{ padding: '20px 0', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                      <button style={{ background: 'none', border: '1.5px solid #E5E7EB', borderRadius: '6px', padding: '6px', color: '#9CA3AF', cursor: 'pointer' }}><Trash2 size={18} /></button>
                      <button style={{ background: 'none', border: '1.5px solid #E5E7EB', borderRadius: '6px', padding: '6px', color: '#9CA3AF', cursor: 'pointer' }}><Edit size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {docs.length === 0 && (
            <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: '40px', fontSize: '14px' }}>No recent quotations found.</p>
          )}
        </div>
      </div>

      <CreateQuotationModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        latestDoc={latestDoc}
        onSelect={() => {
          setIsModalOpen(false);
          onSelectTemplate(latestDoc);
        }}
        onCreateNew={() => {
          setIsModalOpen(false);
          onCreateNewTemplate();
        }}
      />
    </div>
  );
};

export default QuotationView;
