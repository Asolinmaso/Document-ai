import React, { useState, useRef } from 'react';
import { 
  Upload, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  Edit, 
  FileText,
  Briefcase,
  ShieldCheck,
  FileSignature,
  Clock,
  Mail,
  Award,
  Star,
  GraduationCap
} from 'lucide-react';

const TemplateView = ({ templates, onAddTemplate, onDeleteTemplate, onEditTemplate }) => {
  const [expandedCategory, setExpandedCategory] = useState('Quotation');
  const fileInputRef = useRef(null);

  // Form State
  const [docType, setDocType] = useState('Select');
  const [docSubType, setDocSubType] = useState('Select');
  const [templateName, setTemplateName] = useState('');
  const [fileName, setFileName] = useState('No File Chosen');

  // Filter templates for the currently selected category in the sidebar
  const activeCategoryTemplates = templates.filter(t => 
    !expandedCategory ||
    t.type === expandedCategory || 
    (expandedCategory === 'Quotation' && (t.type === 'Quotation' || t.name.toLowerCase().includes('quotation')))
  );

  const [fileData, setFileData] = useState(null);

  const handleUploadClick = () => fileInputRef.current.click();
  
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFileName(file.name);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        setFileData(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddTemplate = () => {
    if (docType === 'Select' || templateName.trim() === '' || fileName === 'No File Chosen') {
      alert('Please fill in all fields and upload a document.');
      return;
    }

    if (!fileData && fileName !== 'No File Chosen') {
      alert('Please wait a moment for the document to finish processing before uploading.');
      return;
    }

    const newTemplate = { 
      name: templateName,
      type: docType,
      edited: 'Just Now',
      file: fileData,
      fileName: fileName
    };
    
    onAddTemplate(newTemplate);

    // Reset Form
    setDocType('Select');
    setDocSubType('Select');
    setTemplateName('');
    setFileName('No File Chosen');
    setFileData(null);
    alert('Template Uploaded and Saved Permanently!');
  };

  const categories = [
    { name: 'Quotation', icon: <FileText size={18} color="#6C2BD9" />, subCategories: ['Recruitment', 'Technology', 'Multimedia', 'Digital Marketing'] },
    { name: 'Invoice', icon: <FileText size={18} color="#EF4444" /> },
    { name: 'NDA', icon: <ShieldCheck size={18} color="#22C55E" /> },
    { name: 'MOU', icon: <FileSignature size={18} color="#3B82F6" /> },
    { name: 'MOM', icon: <Clock size={18} color="#EC4899" /> },
    { name: 'Offer Letter', icon: <Briefcase size={18} color="#06B6D4" /> },
    { name: 'Experience Letter', icon: <Briefcase size={18} color="#EAB308" /> },
    { name: 'Testimonial', icon: <Star size={18} color="#8B5CF6" /> },
    { name: 'Certificate', icon: <GraduationCap size={18} color="#A855F7" /> },
  ];

  return (
    <div className="dashboard-content" style={{ padding: '30px' }}>
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />

      {/* Upload Templates Section */}
      <div style={{ 
        background: 'white', 
        borderRadius: '20px', 
        padding: '30px', 
        marginBottom: '30px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
        border: '1px solid #F3F4F6'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Upload Templates</h2>
          <button 
            onClick={handleAddTemplate}
            style={{ 
              background: '#6C2BD9', 
              color: 'white', 
              padding: '10px 24px', 
              borderRadius: '10px', 
              fontSize: '14px', 
              fontWeight: '600', 
              border: 'none', 
              cursor: 'pointer' 
            }}
          >
            Upload Template
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px 40px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#6B7280' }}>Document Type</label>
            <select 
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              style={{ padding: '12px', borderRadius: '10px', border: '1.5px solid #E5E7EB', outline: 'none', background: 'white' }}
            >
              <option>Select</option>
              <option>Quotation</option>
              <option>Invoice</option>
              <option>NDA</option>
              <option>MOU</option>
              <option>MOM</option>
              <option>Offer Letter</option>
              <option>Experience Letter</option>
              <option>Testimonial</option>
              <option>Certificate</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#6B7280' }}>Document Sub-Type</label>
            <select 
              value={docSubType}
              onChange={(e) => setDocSubType(e.target.value)}
              style={{ padding: '12px', borderRadius: '10px', border: '1.5px solid #E5E7EB', outline: 'none', background: 'white' }}
            >
              <option>Select</option>
              <option>Recruitment</option>
              <option>Technology</option>
              <option>Multimedia</option>
              <option>Digital Marketing</option>
              <option>Marketing</option>
              <option>Sales</option>
              <option>Operations</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#6B7280' }}>Upload Document</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px', border: '1.5px solid #E5E7EB', borderRadius: '10px' }}>
               <span style={{ flex: 1, padding: '0 12px', fontSize: '13px', color: fileName === 'No File Chosen' ? '#9CA3AF' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                 {fileName}
               </span>
               <button onClick={handleUploadClick} style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Upload File</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#6B7280' }}>Template Name</label>
            <input 
              type="text" 
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Enter Template Name"
              style={{ padding: '12px', borderRadius: '10px', border: '1.5px solid #E5E7EB', outline: 'none' }} 
            />
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
           <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 8px 0' }}>This Template Will be Stored In</p>
           <span style={{ 
             display: 'inline-block', 
             background: '#F5F3FF', 
             color: '#6C2BD9', 
             padding: '6px 12px', 
             borderRadius: '6px', 
             fontSize: '13px', 
             fontWeight: '700' 
           }}>
             {docType === 'Select' ? 'Document Type' : docType} &gt; {docSubType === 'Select' ? 'Document Sub-Type' : docSubType}
           </span>
        </div>
      </div>

      {/* Categories and List Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '30px' }}>
        {/* Document Categories */}
        <div style={{ 
          background: 'white', 
          borderRadius: '20px', 
          padding: '30px', 
          boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
          border: '1px solid #F3F4F6'
        }}>
          <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: '0 0 4px 0' }}>Document Categories</h3>
          <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '25px' }}>Browse templates by category and sub category</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {categories.map((cat, i) => (
              <div key={i}>
                <div 
                  onClick={() => setExpandedCategory(expandedCategory === cat.name ? null : cat.name)}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '16px 20px', 
                    borderRadius: '16px', 
                    background: 'white',
                    cursor: 'pointer',
                    boxShadow: expandedCategory === cat.name ? '0 10px 25px rgba(0,0,0,0.05)' : 'none',
                    border: expandedCategory === cat.name ? '1px solid #F3F4F6' : '1px solid transparent',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ 
                      width: '40px', 
                      height: '40px', 
                      background: 'white', 
                      borderRadius: '8px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.04)',
                      border: '1px solid #F9FAFB'
                    }}>
                      {cat.icon}
                    </div>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>{cat.name}</span>
                  </div>
                  {cat.subCategories ? (expandedCategory === cat.name ? <ChevronUp size={20} color="#9CA3AF" /> : <ChevronDown size={20} color="#9CA3AF" />) : <ChevronDown size={20} color="#9CA3AF" />}
                </div>
                
                {expandedCategory === cat.name && cat.subCategories && (
                  <div style={{ paddingLeft: '20px', marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {cat.subCategories.map(sub => (
                      <div key={sub} style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', padding: '4px 10px' }}>
                        <div style={{ background: '#6C2BD9', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 4px 8px rgba(108, 43, 217, 0.2)' }}>
                           <FileText size={16} />
                        </div>
                        <span style={{ fontSize: '15px', color: '#4B5563', fontWeight: '600' }}>{sub}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic Category View */}
        <div style={{ 
          background: '#F9FAFB', 
          borderRadius: '20px', 
          padding: '30px', 
          border: '1px solid #F3F4F6'
        }}>
          <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: '0 0 4px 0' }}>{expandedCategory || 'All Templates'}</h3>
          <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '30px' }}>Templates under {(expandedCategory || 'All').toLowerCase()} category</p>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1.5px solid #111827' }}>
                <th style={{ padding: '12px 0', fontSize: '14px', color: '#111827', fontWeight: '700' }}>Template Name</th>
                <th style={{ padding: '12px 0', fontSize: '14px', color: '#111827', fontWeight: '700', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {activeCategoryTemplates.map((temp, i) => (
                <tr key={i} style={{ borderBottom: i === activeCategoryTemplates.length - 1 ? 'none' : '1px solid #111827' }}>
                  <td style={{ padding: '20px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: '#6C2BD9', color: 'white', borderRadius: '4px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <FileText size={16} />
                      </div>
                      <span style={{ fontWeight: '500', color: '#374151', fontSize: '14px' }}>{temp.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '20px 0', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => onDeleteTemplate(temp.id)}
                        style={{ background: 'none', border: '1.5px solid #D1D5DB', borderRadius: '6px', padding: '6px', color: '#6B7280', cursor: 'pointer' }}
                      >
                        <Trash2 size={18} />
                      </button>
                      <button 
                        onClick={() => onEditTemplate(temp)}
                        style={{ background: 'none', border: '1.5px solid #D1D5DB', borderRadius: '6px', padding: '6px', color: '#6B7280', cursor: 'pointer' }}
                      >
                        <Edit size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {activeCategoryTemplates.length === 0 && (
            <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: '40px', fontSize: '14px' }}>No templates found for this category.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateView;
