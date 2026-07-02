import React, { useState, useRef } from 'react';
import { 
  Camera, 
  Upload, 
  Save, 
  Plus, 
  Trash2, 
  RefreshCcw, 
  Image as ImageIcon,
  PenTool,
  Stamp as StampIcon,
  ShieldCheck
} from 'lucide-react';

const emptyFormState = {
  companyName: '',
  businessType: '',
  industry: '',
  website: '',
  contact: '',
  email: '',
  address: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
};

const ProfileView = ({ savedData, onUpdateProfile, companyLogos, onUpdateLogos }) => {
  const [activeTab, setActiveTab] = useState('Company Information');
  const [activeAssetSubTab, setActiveAssetSubTab] = useState('Logos');
  const fileInputRef = useRef(null);
  const assetFileInputRef = useRef(null);
  
  const [editData, setEditData] = useState({ ...emptyFormState });
  const [logoName, setLogoName] = useState('No File Chosen');

  React.useEffect(() => {
    if (savedData) {
      setEditData(prev => ({ ...prev, ...savedData }));
    }
  }, [savedData]);

  const handleInputChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const handleUploadClick = () => fileInputRef.current.click();
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) setLogoName(e.target.files[0].name);
  };

  const handleSave = async () => {
    try {
      await onUpdateProfile({ ...editData });
      alert('Profile Saved Successfully!');
    } catch (error) {
      console.error("Failed to save profile", error);
      alert('Failed to save profile');
    }
  };

  // Asset Actions (with Base64 conversion for persistence)
  const handleAddAssetClick = () => assetFileInputRef.current.click();
  
  const handleAssetFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onloadend = () => {
        const newLogo = {
          id: Date.now(),
          name: file.name,
          url: reader.result // Base64 string
        };
        onUpdateLogos([...companyLogos, newLogo]);
        alert(`${activeAssetSubTab.slice(0, -1)} uploaded and saved permanently!`);
      };
      
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteLogo = (id) => {
    const updatedLogos = companyLogos.filter(logo => logo.id !== id);
    onUpdateLogos(updatedLogos);
  };

  const assetCategories = [
    { name: 'Logos', icon: <ImageIcon size={18} color="#EF4444" /> },
    { name: 'Signature', icon: <PenTool size={18} color="#22C55E" /> },
    { name: 'Stamp', icon: <StampIcon size={18} color="#3B82F6" /> },
    { name: 'Seal', icon: <ShieldCheck size={18} color="#EC4899" /> },
  ];

  const formFields = [
    { label: 'Company Name', key: 'companyName' },
    { label: 'Business Type', key: 'businessType' },
    { label: 'Industry', key: 'industry' },
    { label: 'Website', key: 'website' },
    { label: 'Contact', key: 'contact' },
    { label: 'Email', key: 'email' },
    { label: 'Address', key: 'address' },
    { label: 'City', key: 'city' },
    { label: 'State', key: 'state' },
    { label: 'Country', key: 'country' },
    { label: 'Postal Code', key: 'postalCode' },
  ];

  return (
    <div className="dashboard-content" style={{ padding: '30px' }}>
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
      <input type="file" ref={assetFileInputRef} style={{ display: 'none' }} onChange={handleAssetFileChange} />

      {/* Profile Header Banner */}
      <div style={{ 
        background: '#F9FAFB', 
        borderRadius: '24px', 
        padding: '35px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '30px',
        marginBottom: '40px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
      }}>
        <div style={{ 
          width: '120px', 
          height: '120px', 
          background: 'white', 
          borderRadius: '50%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          position: 'relative'
        }}>
          <img src="/mabs-logo.png" alt="Profile" style={{ width: '70%', height: '70%', objectFit: 'contain' }} />
          <div onClick={handleUploadClick} style={{ position: 'absolute', bottom: '5px', right: '5px', background: '#6C2BD9', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '3px solid white' }}>
            <Camera size={16} />
          </div>
        </div>

        <div style={{ textAlign: 'left' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#111827', margin: '0 0 8px 0' }}>{savedData.companyName}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#4B5563', fontWeight: '500' }}>{savedData.businessType}</p>
            <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>{savedData.industry}</p>
            <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>{savedData.contact}</p>
            <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>{savedData.email}</p>
            <p style={{ margin: 0, fontSize: '13px', color: '#6C2BD9', fontWeight: '500' }}>{savedData.website}</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#9CA3AF', lineHeight: '1.4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {savedData.address}{savedData.city ? `, ${savedData.city}` : ''}{savedData.state ? `, ${savedData.state}` : ''}{savedData.country ? `, ${savedData.country}` : ''}{savedData.postalCode ? ` - ${savedData.postalCode}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', gap: '30px', marginBottom: '15px' }}>
          {['Company Information', 'Assets'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ background: 'none', border: 'none', fontSize: '16px', fontWeight: activeTab === tab ? '700' : '500', color: activeTab === tab ? '#111827' : '#9CA3AF', cursor: 'pointer', padding: '0 0 10px 0', position: 'relative' }}>
              {tab}
              {activeTab === tab && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: '#6C2BD9', borderRadius: '10px' }}></div>}
            </button>
          ))}
        </div>
        <div style={{ height: '1.5px', background: '#111827', width: '100%' }}></div>
      </div>

      {activeTab === 'Company Information' ? (
        <>
          {/* Form Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '25px 30px', marginBottom: '50px' }}>
            {formFields.map((field, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>{field.label}</label>
                <input type="text" value={editData[field.key]} onChange={(e) => handleInputChange(field.key, e.target.value)} style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid #D1D5DB', fontSize: '14px', outline: 'none', background: '#F9FAFB', transition: 'all 0.2s' }} onFocus={e => { e.target.style.borderColor = '#6C2BD9'; e.target.style.background = 'white'; }} onBlur={e => { e.target.style.borderColor = '#D1D5DB'; e.target.style.background = '#F9FAFB'; }} />
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Logo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px', border: '1px solid #D1D5DB', borderRadius: '10px', background: 'white' }}>
                <span style={{ flex: 1, padding: '0 12px', fontSize: '13px', color: logoName === 'No File Chosen' ? '#9CA3AF' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{logoName}</span>
                <button onClick={handleUploadClick} style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', color: '#374151', cursor: 'pointer' }}><Upload size={14} /> Upload File</button>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={handleSave} style={{ background: '#6C2BD9', color: 'white', padding: '14px 60px', borderRadius: '12px', fontSize: '16px', fontWeight: '700', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 10px 15px -3px rgba(108, 43, 217, 0.3)' }}><Save size={20} /> Save Changes</button>
          </div>
        </>
      ) : (
        /* Assets View */
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '40px' }}>
          {/* Assets Sidebar */}
          <div style={{ background: '#F9FAFB', borderRadius: '20px', padding: '24px', height: 'fit-content' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '24px' }}>Assets</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {assetCategories.map(cat => (
                <div 
                  key={cat.name} 
                  onClick={() => setActiveAssetSubTab(cat.name)}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    padding: '12px 16px', 
                    borderRadius: '12px', 
                    background: activeAssetSubTab === cat.name ? 'white' : 'transparent',
                    boxShadow: activeAssetSubTab === cat.name ? '0 4px 10px rgba(0,0,0,0.04)' : 'none',
                    cursor: 'pointer',
                    color: activeAssetSubTab === cat.name ? '#111827' : '#6B7280',
                    fontWeight: activeAssetSubTab === cat.name ? '700' : '500',
                    transition: 'all 0.2s'
                  }}
                >
                  {cat.icon}
                  <span style={{ fontSize: '14px' }}>{cat.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Asset Content */}
          <div style={{ background: '#F9FAFB', borderRadius: '20px', padding: '35px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <div>
                <h3 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>{activeAssetSubTab}</h3>
                <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>Upload & manage all company {activeAssetSubTab.toLowerCase()}.</p>
              </div>
              <button onClick={handleAddAssetClick} style={{ background: '#6C2BD9', color: 'white', padding: '10px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer' }}>Add {activeAssetSubTab.slice(0, -1)}</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
              {/* Dynamic Asset Cards (Restored from companyLogos) */}
              {companyLogos.map(logo => (
                <div key={logo.id} style={{ background: 'white', borderRadius: '16px', border: '1.5px solid #F3F4F6', overflow: 'hidden' }}>
                  <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <img src={logo.url} alt={logo.name} style={{ maxWidth: '80%', maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                  <div style={{ background: '#F9FAFB', padding: '16px', borderTop: '1.5px solid #F3F4F6' }}>
                    <p style={{ fontSize: '12px', fontWeight: '700', color: '#111827', marginBottom: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{logo.name}</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={handleAddAssetClick} style={{ flex: 1, padding: '8px', border: '1.5px solid #6C2BD9', color: '#6C2BD9', background: 'white', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Replace</button>
                      <button onClick={() => handleDeleteLogo(logo.id)} style={{ flex: 1, padding: '8px', border: '1.5px solid #EF4444', color: '#EF4444', background: 'white', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add New Asset Card */}
              <div 
                onClick={handleAddAssetClick}
                style={{ background: 'white', borderRadius: '16px', border: '2px dashed #E5E7EB', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', cursor: 'pointer', height: '235px' }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #6C2BD9', color: '#6C2BD9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                  <Plus size={24} strokeWidth={3} />
                </div>
                <p style={{ fontSize: '14px', fontWeight: '700', color: '#111827', margin: '0 0 4px 0' }}>Add New {activeAssetSubTab.slice(0, -1)}</p>
                <p style={{ fontSize: '10px', color: '#9CA3AF', textAlign: 'center' }}>JPEG, JPG, PNG or SVG<br/>Max size 2MB</p>
              </div>
            </div>
            
            {companyLogos.length === 0 && activeAssetSubTab === 'Logos' && (
              <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: '40px', fontSize: '13px' }}>No logos uploaded yet. Click above to add your first logo.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileView;
