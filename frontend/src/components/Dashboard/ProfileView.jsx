import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  Save,
  Plus,
  Trash2,
  Image as ImageIcon,
  PenTool,
  Stamp as StampIcon,
  ShieldCheck,
  Building2,
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

const ProfileView = ({ savedData, onUpdateProfile, companyLogos = [], onUpdateLogos, showToast }) => {
  const [activeTab, setActiveTab] = useState('Company Information');
  const [activeAssetSubTab, setActiveAssetSubTab] = useState('Logos');
  const [editData, setEditData] = useState({ ...emptyFormState });
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const assetFileInputRef = useRef(null);

  // Sync form when savedData arrives or changes
  useEffect(() => {
    if (savedData) {
      setEditData({ ...emptyFormState, ...savedData });
    }
  }, [savedData]);

  const handleInputChange = (field, value) =>
    setEditData((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdateProfile({ ...editData });
      // showToast is called inside onUpdateProfile in Dashboard
    } catch {
      showToast?.('Failed to save profile. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Logo / Asset management
  const handleAddAssetClick = () => assetFileInputRef.current?.click();

  const handleAssetFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast?.('File size exceeds 2 MB limit.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const newLogo = { id: Date.now(), name: file.name, url: reader.result };
      onUpdateLogos([...companyLogos, newLogo]);
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const handleDeleteLogo = (id) => {
    onUpdateLogos(companyLogos.filter((l) => l.id !== id));
  };

  const assetCategories = [
    { name: 'Logos', icon: <ImageIcon size={16} color="#EF4444" /> },
    { name: 'Signature', icon: <PenTool size={16} color="#22C55E" /> },
    { name: 'Stamp', icon: <StampIcon size={16} color="#3B82F6" /> },
    { name: 'Seal', icon: <ShieldCheck size={16} color="#EC4899" /> },
  ];

  const formFields = [
    { label: 'Company Name', key: 'companyName', type: 'text', span: 1 },
    { label: 'Business Type', key: 'businessType', type: 'text', span: 1 },
    { label: 'Industry', key: 'industry', type: 'text', span: 1 },
    { label: 'Website', key: 'website', type: 'url', span: 1 },
    { label: 'Contact Number', key: 'contact', type: 'tel', span: 1 },
    { label: 'Email Address', key: 'email', type: 'email', span: 1 },
    { label: 'Address', key: 'address', type: 'text', span: 3 },
    { label: 'City', key: 'city', type: 'text', span: 1 },
    { label: 'State / Province', key: 'state', type: 'text', span: 1 },
    { label: 'Country', key: 'country', type: 'text', span: 1 },
    { label: 'Postal Code', key: 'postalCode', type: 'text', span: 1 },
  ];

  const inputStyle = {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #D1D5DB',
    fontSize: '14px',
    outline: 'none',
    background: '#F9FAFB',
    transition: 'all 0.2s',
    width: '100%',
    color: '#111827',
  };

  // Safe defaults when savedData is still loading
  const displayName = savedData?.companyName || '—';
  const displayType = savedData?.businessType || '';
  const displayIndustry = savedData?.industry || '';

  return (
    <div className="dashboard-content" style={{ padding: '30px' }}>
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleAssetFileChange} />
      <input type="file" ref={assetFileInputRef} style={{ display: 'none' }} accept="image/png,image/jpeg,image/jpg,image/svg+xml" onChange={handleAssetFileChange} />

      {/* Profile Header */}
      <div style={{ background: '#F9FAFB', borderRadius: '20px', padding: '28px 32px', display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
        <div style={{ width: '80px', height: '80px', background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', position: 'relative', flexShrink: 0 }}>
          {companyLogos[0] ? (
            <img src={companyLogos[0].url} alt="Company logo" style={{ width: '70%', height: '70%', objectFit: 'contain' }} />
          ) : (
            <Building2 size={32} color="#D1D5DB" />
          )}
          <div
            onClick={() => assetFileInputRef.current?.click()}
            title="Upload logo"
            style={{ position: 'absolute', bottom: '2px', right: '2px', background: '#6C2BD9', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid white' }}
          >
            <Camera size={12} />
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#111827', margin: '0 0 4px 0' }}>
            {displayName}
          </h2>
          {displayType && <p style={{ margin: '0 0 2px', fontSize: '13px', color: '#4B5563', fontWeight: '500' }}>{displayType}</p>}
          {displayIndustry && <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF' }}>{displayIndustry}</p>}
          {savedData?.email && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6B7280' }}>{savedData.email}</p>}
          {savedData?.contact && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6B7280' }}>{savedData.contact}</p>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', gap: '24px', borderBottom: '2px solid #E5E7EB' }}>
          {['Company Information', 'Assets'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '14px',
                fontWeight: activeTab === tab ? '700' : '500',
                color: activeTab === tab ? '#6C2BD9' : '#6B7280',
                cursor: 'pointer',
                padding: '10px 0',
                marginBottom: '-2px',
                borderBottom: activeTab === tab ? '2px solid #6C2BD9' : '2px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'Company Information' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px 24px', marginBottom: '40px' }}>
            {formFields.map((field, i) => (
              <div
                key={i}
                style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: field.span === 3 ? '1 / -1' : undefined }}
              >
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {field.label}
                </label>
                <input
                  type={field.type}
                  value={editData[field.key]}
                  onChange={(e) => handleInputChange(field.key, e.target.value)}
                  style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = '#6C2BD9'; e.target.style.background = 'white'; e.target.style.boxShadow = '0 0 0 3px rgba(108,43,217,0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#D1D5DB'; e.target.style.background = '#F9FAFB'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ background: saving ? '#A78BFA' : '#6C2BD9', color: 'white', padding: '12px 40px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(108,43,217,0.25)', transition: 'all 0.2s' }}
            >
              <Save size={16} />
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '24px' }}>
          {/* Asset sidebar */}
          <div style={{ background: '#F9FAFB', borderRadius: '16px', padding: '20px', height: 'fit-content' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#374151', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Categories</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {assetCategories.map((cat) => (
                <div
                  key={cat.name}
                  onClick={() => setActiveAssetSubTab(cat.name)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: activeAssetSubTab === cat.name ? 'white' : 'transparent', boxShadow: activeAssetSubTab === cat.name ? '0 2px 8px rgba(0,0,0,0.06)' : 'none', cursor: 'pointer', color: activeAssetSubTab === cat.name ? '#111827' : '#6B7280', fontWeight: activeAssetSubTab === cat.name ? '600' : '400', fontSize: '13px', transition: 'all 0.15s' }}
                >
                  {cat.icon}
                  <span>{cat.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Asset content */}
          <div style={{ background: '#F9FAFB', borderRadius: '16px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: 0 }}>{activeAssetSubTab}</h3>
                <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>Upload & manage company {activeAssetSubTab.toLowerCase()}</p>
              </div>
              <button
                onClick={handleAddAssetClick}
                style={{ background: '#6C2BD9', color: 'white', padding: '9px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={14} /> Add {activeAssetSubTab.slice(0, -1)}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
              {companyLogos.map((logo) => (
                <div key={logo.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                  <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <img src={logo.url} alt={logo.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                  <div style={{ background: '#F9FAFB', padding: '12px', borderTop: '1px solid #E5E7EB' }}>
                    <p style={{ fontSize: '11px', fontWeight: '600', color: '#374151', marginBottom: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={logo.name}>{logo.name}</p>
                    <button
                      onClick={() => handleDeleteLogo(logo.id)}
                      style={{ width: '100%', padding: '6px', border: '1px solid #EF4444', color: '#EF4444', background: 'white', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                </div>
              ))}

              {/* Add new card */}
              <div
                onClick={handleAddAssetClick}
                style={{ background: 'white', borderRadius: '12px', border: '2px dashed #D1D5DB', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', cursor: 'pointer', minHeight: '170px', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#6C2BD9'; e.currentTarget.style.background = '#F5F3FF'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.background = 'white'; }}
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid #6C2BD9', color: '#6C2BD9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                  <Plus size={20} />
                </div>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#374151', margin: '0 0 4px' }}>Add {activeAssetSubTab.slice(0, -1)}</p>
                <p style={{ fontSize: '10px', color: '#9CA3AF', textAlign: 'center', margin: 0 }}>PNG, JPG, SVG — max 2 MB</p>
              </div>
            </div>

            {companyLogos.length === 0 && (
              <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '13px', marginTop: '20px' }}>
                No {activeAssetSubTab.toLowerCase()} uploaded yet.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileView;
