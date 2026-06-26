import React, { useState, useEffect } from 'react';
import DocumentView from './DocumentView';
import QuotationView from './QuotationView';
import EditorView from './EditorView';
import ProfileView from './ProfileView';
import TrashView from './TrashView';
import TemplateView from './TemplateView';
import TemplateEditorView from './TemplateEditorView';
import MailCenterView from './MailCenterView';
import {
  LayoutDashboard,
  FileText,
  Layers,
  Mail,
  User,
  Trash2,
  Search,
  Edit
} from 'lucide-react';

// Refined Solid Document Icon Component
const SolidDocIcon = ({ color, size = 'md' }) => {
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
      {/* Dog ear fold */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '10px',
        height: '10px',
        background: 'rgba(255,255,255,0.4)',
        borderBottomLeftRadius: '3px'
      }}></div>
      {/* Decorative lines */}
      <div style={{ width: '50%', height: '2px', background: 'rgba(255,255,255,0.6)', position: 'absolute', top: '30%' }}></div>
      <div style={{ width: '50%', height: '2px', background: 'rgba(255,255,255,0.6)', position: 'absolute', top: '45%' }}></div>
      <div style={{ width: '30%', height: '2px', background: 'rgba(255,255,255,0.6)', position: 'absolute', top: '60%', left: '25%' }}></div>
    </div>
  );
};

const Sidebar = ({ activeTab, onTabClick }) => {
  const menuItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { name: 'Document', icon: <FileText size={18} /> },
    { name: 'Template', icon: <Layers size={18} /> },
    { name: 'Mail Center', icon: <Mail size={18} /> },
    { name: 'My Profile', icon: <User size={18} /> },
    { name: 'Trash', icon: <Trash2 size={18} /> },
  ];

  return (
    <div className="sidebar" style={{ background: '#6C2BD9' }}>
      <div className="logo-container" style={{
        color: 'white',
        fontSize: '24px',
        fontWeight: '700',
        padding: '10px 20px',
        marginBottom: '30px',
        display: 'flex',
        alignItems: 'center'
      }}>
        DocAI
      </div>
      <ul className="nav-links">
        {menuItems.map((item) => (
          <li
            key={item.name}
            className={`nav-item ${activeTab === item.name ? 'active' : ''}`}
            onClick={() => onTabClick(item.name)}
            style={activeTab === item.name ? {
              background: 'white',
              color: '#6C2BD9',
              borderRadius: '10px',
              margin: '4px 10px',
              padding: '12px 16px'
            } : {
              color: 'rgba(255,255,255,0.8)',
              margin: '4px 10px',
              padding: '12px 16px'
            }}
          >
            {item.icon}
            <span style={{ fontWeight: activeTab === item.name ? '700' : '500' }}>{item.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const Topbar = ({ searchQuery, onSearchChange, activeTab }) => {
  return (
    <div className="top-bar">
      <h2>{activeTab}</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
        <div className="search-container">
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.6)' }} />
          <input
            type="text"
            className="search-input"
            placeholder="Search Documents..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => alert('Profile Clicked')}>
          <div style={{ width: '45px', height: '45px', background: '#fff', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
              src="/mabs-logo.png"
              alt="MABS Logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}
            />
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: '13px', fontWeight: '700', margin: 0, letterSpacing: '0.2px' }}>Manvian Business</p>
            <p style={{ fontSize: '13px', fontWeight: '700', margin: 0, letterSpacing: '0.2px' }}>Solutions</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const QuickActions = ({ onActionClick }) => {
  const actions = [
    { name: 'Create Quotation', color: '#6C2BD9' },
    { name: 'Create Invoice', color: '#EF4444' },
    { name: 'Create MOU', color: '#22C55E' },
    { name: 'Create NDA', color: '#3B82F6' },
    { name: 'Create MOM', color: '#D81B60' },
    { name: 'More', color: '#9CA3AF', isMore: true },
  ];

  return (
    <div style={{ marginBottom: '40px' }}>
      <h3 className="section-title" style={{ fontSize: '18px', fontWeight: '700', marginBottom: '25px', color: '#111827' }}>Quick Actions</h3>
      <div className="quick-actions-grid" style={{
        display: 'flex',
        gap: '16px',
        overflowX: 'auto',
        paddingBottom: '20px',
        borderBottom: '1.5px solid #111827',
        marginBottom: '40px'
      }}>
        {actions.map((action, i) => (
          <div
            key={i}
            className="action-card"
            onClick={() => onActionClick(action.name)}
            style={{
              minWidth: '130px',
              flex: '1',
              background: '#FFFFFF',
              border: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
              borderRadius: '12px',
              padding: '16px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px'
            }}
          >
            {action.isMore ? (
              <div style={{ width: '28px', height: '28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', background: '#9CA3AF', borderRadius: '4px', padding: '4px' }}>
                <div style={{ background: 'white', borderRadius: '1px' }}></div>
                <div style={{ background: 'white', borderRadius: '1px' }}></div>
                <div style={{ background: 'white', borderRadius: '1px' }}></div>
                <div style={{ background: 'white', borderRadius: '1px' }}></div>
              </div>
            ) : (
              <SolidDocIcon color={action.color} size="sm" />
            )}
            <p style={{ fontWeight: '700', color: '#111827', fontSize: '12px', margin: 0, textAlign: 'center' }}>{action.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const RecentDocuments = ({ docs, onRowClick }) => {
  return (
    <div>
      <h3 className="section-title">Recent Documents ({docs.length})</h3>
      <div style={{ background: 'transparent' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1.5px solid #1F2937' }}>
              <th style={{ padding: '12px 0', fontSize: '13px', color: '#111827', fontWeight: '700' }}>Name</th>
              <th style={{ padding: '12px 0', fontSize: '13px', color: '#111827', fontWeight: '700' }}>Type</th>
              <th style={{ padding: '12px 0', fontSize: '13px', color: '#111827', fontWeight: '700' }}>Edited</th>
              <th style={{ padding: '12px 0', fontSize: '13px', color: '#111827', fontWeight: '700', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc, i) => (
              <tr
                key={i}
                onClick={() => onRowClick(doc)}
                style={{ cursor: 'pointer', borderBottom: i === docs.length - 1 ? 'none' : '1px solid #1F2937' }}
              >
                <td style={{ padding: '16px 0' }}>
                  <div className="doc-info" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="doc-icon" style={{ background: '#6C2BD9', color: 'white', borderRadius: '4px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={16} />
                    </div>
                    <span style={{ fontWeight: '500', color: '#1F2937', fontSize: '14px' }}>{doc.name}</span>
                  </div>
                </td>
                <td style={{ padding: '16px 0', color: '#4B5563', fontSize: '14px' }}>
                  <span>{doc.type}</span>
                </td>
                <td style={{ padding: '16px 0', color: '#4B5563', fontSize: '14px' }}>
                  <span>{doc.edited}</span>
                </td>
                <td style={{ padding: '16px 0', textAlign: 'right' }}>
                  <div className="action-buttons" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                    <button className="icon-btn" onClick={() => alert('Delete clicked')}><Trash2 size={18} style={{ color: '#9CA3AF' }} /></button>
                    <button className="icon-btn" onClick={() => alert('Edit clicked')}><Edit size={18} style={{ color: '#9CA3AF' }} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>
                  No documents found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DashboardContent = ({ docs, onActionClick, onRowClick }) => {
  return (
    <div className="dashboard-content">
      <QuickActions onActionClick={onActionClick} />
      <RecentDocuments docs={docs} onRowClick={onRowClick} />
    </div>
  );
};

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [currentSubView, setCurrentSubView] = useState(null); // 'quotation', etc.
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // State variables for backend data
  const [profileData, setProfileData] = useState(null);
  const [companyLogos, setCompanyLogos] = useState([]);
  const [allDocs, setAllDocs] = useState([]);

  useEffect(() => {
    // Fetch initial data from backend API
    const fetchData = async () => {
      try {
        const [docsRes, profileRes, logosRes] = await Promise.all([
          fetch('/api/documents'),
          fetch('/api/profile'),
          fetch('/api/logos')
        ]);
        
        if (docsRes.ok) setAllDocs(await docsRes.json());
        if (profileRes.ok) {
          const profile = await profileRes.json();
          if (!profile.companyName) {
            setProfileData({
              companyName: 'Manvian Business Solutions',
              businessType: 'Private Limited',
              industry: 'service provider',
              website: 'www.manvian.com',
              contact: '8778359643',
              email: 'Operations@manvian.com',
              address: 'No.4, 1st floor, Alamathi main road, New vellanur, Avadi',
              city: 'chennai',
              state: 'Tamil Nadu',
              country: 'India',
              postalCode: '600062'
            });
          } else {
            setProfileData(profile);
          }
        }
        if (logosRes.ok) setCompanyLogos(await logosRes.json());
      } catch (err) {
        console.error("Failed to load initial data from backend:", err);
      }
    };
    fetchData();
  }, []);

  const handleUpdateProfile = async (newData) => {
    setProfileData(newData);
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData)
      });
    } catch (err) { console.error(err); }
  };

  const handleUpdateLogos = async (newLogos) => {
    setCompanyLogos(newLogos);
    try {
      await fetch('/api/logos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLogos)
      });
    } catch (err) { console.error(err); }
  };

  const handleAddDocument = async (newDoc) => {
    const docWithId = { ...newDoc, id: Date.now(), status: 'active' };
    setAllDocs([docWithId, ...allDocs]);
    try {
      await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docWithId)
      });
    } catch (err) { console.error(err); }
  };

  const handleDeleteDocument = (id) => {
    // We move to trash instead of permanent delete for safety
    handleUpdateDocStatus(id, 'trash');
    alert('Document moved to trash!');
  };

  const handleDeletePermanently = async (id) => {
    setAllDocs(prev => prev.filter(doc => doc.id !== id));
    try {
      await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    } catch (err) { console.error(err); }
  };

  const handleEmptyTrash = async () => {
    const trashIds = allDocs.filter(doc => doc.status === 'trash').map(doc => doc.id);
    setAllDocs(prev => prev.filter(doc => doc.status !== 'trash'));
    for (const id of trashIds) {
      try {
        await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      } catch (err) { console.error(err); }
    }
  };

  const handleRowClick = (doc) => {
    setSelectedDoc(doc);
    setCurrentSubView('editor');
  };

  const handleEditDocument = (doc) => {
    setSelectedDoc(doc);
    setCurrentSubView('editor');
  };

  const handleUpdateDocStatus = async (id, newStatus) => {
    const docToUpdate = allDocs.find(d => d.id === id);
    if (!docToUpdate) return;
    
    const updatedDoc = { ...docToUpdate, status: newStatus };
    setAllDocs(allDocs.map(doc => doc.id === id ? updatedDoc : doc));
    
    try {
      await fetch(`/api/documents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDoc)
      });
    } catch (err) { console.error(err); }
  };

  const activeDocs = allDocs.filter(doc => doc.status === 'active');
  const trashDocs = allDocs.filter(doc => doc.status === 'trash');

  const filteredDocs = activeDocs.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTrash = trashDocs.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredQuotationDocs = activeDocs.filter(doc => 
    (doc.type === 'Quotation' || doc.name.toLowerCase().includes('quotation')) &&
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleActionClick = (actionName) => {
    if (actionName === 'Create Quotation') {
      setCurrentSubView('quotation');
    } else {
      alert(`Action: ${actionName}`);
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar activeTab={activeTab} onTabClick={(tab) => {
        setActiveTab(tab);
        setCurrentSubView(null);
        setSearchQuery('');
      }} />
      <div className="main-content">
        <Topbar searchQuery={searchQuery} onSearchChange={setSearchQuery} activeTab={currentSubView ? 'Quotation' : activeTab} />

        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', display: 'flex', flexDirection: 'column', background: currentSubView === 'editor' ? '#FFFFFF' : 'transparent' }}>
          {currentSubView === 'editor' ? (
            <EditorView 
              doc={selectedDoc} 
              onBack={() => setCurrentSubView('quotation')} 
              logo={companyLogos[0]?.url} 
            />
          ) : currentSubView === 'template_editor' ? (
            <TemplateEditorView 
              onBack={() => setCurrentSubView('quotation')} 
              docName="Recruitment Template"
            />
          ) : activeTab === 'Dashboard' ? (
            currentSubView === 'quotation' ? (
              <QuotationView docs={filteredQuotationDocs} onBack={() => setCurrentSubView(null)} onSelectTemplate={(doc) => { setSelectedDoc(doc); setCurrentSubView('editor'); }} onCreateNewTemplate={() => setCurrentSubView('template_editor')} searchQuery={searchQuery} />
            ) : (
              <DashboardContent docs={filteredDocs} onActionClick={handleActionClick} onRowClick={handleRowClick} />
            )
          ) : activeTab === 'Document' ? (
            currentSubView === 'quotation' ? (
              <QuotationView docs={filteredQuotationDocs} onBack={() => setCurrentSubView(null)} onSelectTemplate={(doc) => { setSelectedDoc(doc); setCurrentSubView('editor'); }} onCreateNewTemplate={() => setCurrentSubView('template_editor')} searchQuery={searchQuery} />
            ) : (
              <DocumentView docs={filteredDocs} searchQuery={searchQuery} onSearchChange={setSearchQuery} onActionClick={handleActionClick} onRowClick={handleRowClick} />
            )
          ) : activeTab === 'Template' ? (
            <TemplateView 
              templates={activeDocs} 
              onAddTemplate={handleAddDocument} 
              onDeleteTemplate={handleDeleteDocument}
              onEditTemplate={handleEditDocument}
            />
          ) : activeTab === 'My Profile' ? (
            <ProfileView 
              savedData={profileData} 
              onUpdateProfile={handleUpdateProfile} 
              companyLogos={companyLogos}
              onUpdateLogos={handleUpdateLogos}
            />
          ) : activeTab === 'Trash' ? (
            <TrashView 
              docs={filteredTrash} 
              onRestore={(id) => handleUpdateDocStatus(id, 'active')} 
              onDeletePermanently={handleDeletePermanently}
              onEmptyTrash={handleEmptyTrash}
              searchQuery={searchQuery} 
            />
          ) : activeTab === 'Mail Center' ? (
            <MailCenterView />
          ) : (
            <div className="dashboard-content">
              <h3 className="section-title">{activeTab} Page Coming Soon...</h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
