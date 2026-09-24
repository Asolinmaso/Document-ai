import React, { useState, useEffect, useCallback } from 'react';
import DocumentView from './DocumentView';
import QuotationView from './QuotationView';
import EditorView from './EditorView';
import ProfileView from './ProfileView';
import TrashView from './TrashView';
import TemplateView from './TemplateView';
import TemplateEditorView from './TemplateEditorView';
import MailCenterView from './MailCenterView';
import ExtractionView from './ExtractionView';
import {
  LayoutDashboard,
  FileText,
  Layers,
  Mail,
  User,
  Trash2,
  Search,
  Edit,
  Sparkles,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import {
  fetchProfile,
  updateProfile,
  fetchLogos,
  updateLogos,
  fetchDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
} from '../../services/dataService';

// ── Shared sub-components ─────────────────────────────────────────────────────

const SolidDocIcon = ({ color, size = 'md' }) => {
  const width = size === 'sm' ? '30px' : '40px';
  const height = size === 'sm' ? '38px' : '50px';
  return (
    <div style={{ width, height, background: color, borderRadius: '4px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 10px ${color}30` }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: '10px', height: '10px', background: 'rgba(255,255,255,0.4)', borderBottomLeftRadius: '3px' }} />
      <div style={{ width: '50%', height: '2px', background: 'rgba(255,255,255,0.6)', position: 'absolute', top: '30%' }} />
      <div style={{ width: '50%', height: '2px', background: 'rgba(255,255,255,0.6)', position: 'absolute', top: '45%' }} />
      <div style={{ width: '30%', height: '2px', background: 'rgba(255,255,255,0.6)', position: 'absolute', top: '60%', left: '25%' }} />
    </div>
  );
};

// ── Sidebar ───────────────────────────────────────────────────────────────────

const Sidebar = ({ activeTab, onTabClick, onLogout, currentUser }) => {
  const menuItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { name: 'Document', icon: <FileText size={18} /> },
    { name: 'AI Extract', icon: <Sparkles size={18} /> },
    { name: 'Template', icon: <Layers size={18} /> },
    { name: 'Mail Center', icon: <Mail size={18} /> },
    { name: 'My Profile', icon: <User size={18} /> },
    { name: 'Trash', icon: <Trash2 size={18} /> },
  ];

  return (
    <div className="sidebar" style={{ background: '#6C2BD9', display: 'flex', flexDirection: 'column' }}>
      <div style={{ color: 'white', fontSize: '22px', fontWeight: '700', padding: '10px 20px', marginBottom: '30px', letterSpacing: '-0.5px' }}>
        DocAI
      </div>

      <ul className="nav-links" style={{ flex: 1 }}>
        {menuItems.map((item) => (
          <li
            key={item.name}
            className={`nav-item ${activeTab === item.name ? 'active' : ''}`}
            onClick={() => onTabClick(item.name)}
            style={activeTab === item.name
              ? { background: 'white', color: '#6C2BD9', borderRadius: '10px', margin: '4px 10px', padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '700', fontSize: '14px', transition: 'all 0.2s' }
              : { color: 'rgba(255,255,255,0.8)', margin: '4px 10px', padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '500', fontSize: '14px', borderRadius: '10px', transition: 'all 0.2s' }
            }
          >
            {item.icon}
            <span>{item.name}</span>
          </li>
        ))}
      </ul>

      {/* User footer */}
      <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '13px', flexShrink: 0 }}>
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser?.name || 'User'}</p>
            <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser?.email || ''}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{ width: '100%', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );
};

// ── Topbar ────────────────────────────────────────────────────────────────────

const Topbar = ({ searchQuery, onSearchChange, title, profileData }) => (
  <div className="top-bar">
    <h2 style={{ fontSize: '18px', fontWeight: '700' }}>{title}</h2>
    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
      <div className="search-container">
        <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)', pointerEvents: 'none' }} />
        <input
          type="text"
          className="search-input"
          placeholder="Search documents…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      {profileData?.companyName && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '36px', height: '36px', background: 'rgba(255,255,255,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            <img src="/mabs-logo.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} onError={(e) => { e.target.style.display = 'none'; }} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {profileData.companyName}
          </span>
        </div>
      )}
    </div>
  </div>
);

// ── Quick Actions ─────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { name: 'Create Quotation', color: '#6C2BD9' },
  { name: 'Create Invoice', color: '#EF4444' },
  { name: 'Create MOU', color: '#22C55E' },
  { name: 'Create NDA', color: '#3B82F6' },
  { name: 'Create MOM', color: '#D81B60' },
  { name: 'More', color: '#9CA3AF', isMore: true },
];

const QuickActions = ({ onActionClick }) => (
  <div style={{ marginBottom: '40px' }}>
    <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px', color: '#111827' }}>Quick Actions</h3>
    <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '20px', borderBottom: '1.5px solid #E5E7EB', marginBottom: '40px' }}>
      {QUICK_ACTIONS.map((action, i) => (
        <div
          key={i}
          className="action-card"
          onClick={() => onActionClick(action.name)}
          title={action.name}
          style={{ minWidth: '120px', flex: '1', background: '#FFFFFF', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.04)', borderRadius: '12px', padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', transition: 'all 0.2s' }}
        >
          {action.isMore ? (
            <div style={{ width: '28px', height: '28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', background: '#9CA3AF', borderRadius: '4px', padding: '4px' }}>
              {[0,1,2,3].map(j => <div key={j} style={{ background: 'white', borderRadius: '1px' }} />)}
            </div>
          ) : (
            <SolidDocIcon color={action.color} size="sm" />
          )}
          <p style={{ fontWeight: '600', color: '#374151', fontSize: '11px', margin: 0, textAlign: 'center' }}>{action.name}</p>
        </div>
      ))}
    </div>
  </div>
);

// ── Recent Documents Table ────────────────────────────────────────────────────

const RecentDocuments = ({ docs, onRowClick, onDeleteDoc, onEditDoc }) => (
  <div>
    <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#111827' }}>
      Recent Documents <span style={{ color: '#9CA3AF', fontWeight: '500' }}>({docs.length})</span>
    </h3>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ textAlign: 'left', borderBottom: '1.5px solid #E5E7EB' }}>
          <th style={{ padding: '10px 0', fontSize: '12px', color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
          <th style={{ padding: '10px 0', fontSize: '12px', color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</th>
          <th style={{ padding: '10px 0', fontSize: '12px', color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Edited</th>
          <th style={{ padding: '10px 0', fontSize: '12px', color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {docs.map((doc, i) => (
          <tr
            key={doc.id || i}
            onClick={() => onRowClick(doc)}
            style={{ cursor: 'pointer', borderBottom: i === docs.length - 1 ? 'none' : '1px solid #F3F4F6', transition: 'background 0.15s' }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <td style={{ padding: '14px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#EDE9FE', color: '#6C2BD9', borderRadius: '6px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={14} />
                </div>
                <span style={{ fontWeight: '500', color: '#111827', fontSize: '13px' }}>{doc.name}</span>
              </div>
            </td>
            <td style={{ padding: '14px 0', color: '#6B7280', fontSize: '13px' }}>
              <span style={{ background: '#F3F4F6', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '500' }}>{doc.type || '—'}</span>
            </td>
            <td style={{ padding: '14px 0', color: '#9CA3AF', fontSize: '12px' }}>{doc.edited || '—'}</td>
            <td style={{ padding: '14px 0', textAlign: 'right' }}>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                <button
                  className="icon-btn"
                  onClick={() => onDeleteDoc && onDeleteDoc(doc.id)}
                  title="Move to trash"
                  style={{ background: 'none', border: '1.5px solid #E5E7EB', borderRadius: '6px', padding: '5px', color: '#9CA3AF', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
                >
                  <Trash2 size={14} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => onEditDoc && onEditDoc(doc)}
                  title="Edit document"
                  style={{ background: 'none', border: '1.5px solid #E5E7EB', borderRadius: '6px', padding: '5px', color: '#9CA3AF', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
                >
                  <Edit size={14} />
                </button>
              </div>
            </td>
          </tr>
        ))}
        {docs.length === 0 && (
          <tr>
            <td colSpan="4" style={{ textAlign: 'center', padding: '50px', color: '#9CA3AF', fontSize: '14px' }}>
              <FileText size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p style={{ margin: 0 }}>No documents yet. Use Quick Actions to create one.</p>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

// ── Dashboard Content (home page) ─────────────────────────────────────────────

const DashboardHome = ({ docs, onActionClick, onRowClick, onDeleteDoc, onEditDoc }) => (
  <div className="dashboard-content">
    <QuickActions onActionClick={onActionClick} />
    <RecentDocuments docs={docs} onRowClick={onRowClick} onDeleteDoc={onDeleteDoc} onEditDoc={onEditDoc} />
  </div>
);

// ── Loading Skeleton ──────────────────────────────────────────────────────────

const LoadingSkeleton = () => (
  <div className="dashboard-content" style={{ padding: '40px' }}>
    {[1, 2, 3].map((i) => (
      <div key={i} style={{ height: '40px', background: '#F3F4F6', borderRadius: '8px', marginBottom: '16px', animation: 'pulse 1.5s ease-in-out infinite' }} />
    ))}
    <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }`}</style>
  </div>
);

// ── Main Dashboard ────────────────────────────────────────────────────────────

const Dashboard = ({ currentUser, onLogout, showToast }) => {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [currentSubView, setCurrentSubView] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [profileData, setProfileData] = useState(null);
  const [companyLogos, setCompanyLogos] = useState([]);
  const [allDocs, setAllDocs] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState('');

  // Initial data fetch
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setDataLoading(true);
      setDataError('');
      try {
        const [docs, profile, logos] = await Promise.all([
          fetchDocuments(),
          fetchProfile(),
          fetchLogos(),
        ]);
        if (!cancelled) {
          setAllDocs(docs || []);
          setProfileData(profile || {});
          setCompanyLogos(logos || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load data:', err);
          setDataError('Failed to load data. Please refresh the page.');
          showToast?.('Failed to load data. Please refresh.', 'error');
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleUpdateProfile = useCallback(async (newData) => {
    setProfileData(newData);
    try {
      const saved = await updateProfile(newData);
      setProfileData(saved);
      showToast?.('Profile saved successfully!', 'success');
    } catch (err) {
      showToast?.(err.message || 'Failed to save profile.', 'error');
    }
  }, [showToast]);

  const handleUpdateLogos = useCallback(async (newLogos) => {
    setCompanyLogos(newLogos);
    try {
      await updateLogos(newLogos);
      showToast?.('Assets updated.', 'success');
    } catch (err) {
      showToast?.(err.message || 'Failed to update assets.', 'error');
    }
  }, [showToast]);

  const handleAddDocument = useCallback(async (newDoc) => {
    const optimisticDoc = { ...newDoc, id: Date.now(), status: 'active' };
    setAllDocs((prev) => [optimisticDoc, ...prev]);
    try {
      const saved = await createDocument(newDoc);
      // Replace the optimistic entry with the real server response
      setAllDocs((prev) => prev.map((d) => (d.id === optimisticDoc.id ? saved : d)));
    } catch (err) {
      // Roll back
      setAllDocs((prev) => prev.filter((d) => d.id !== optimisticDoc.id));
      showToast?.(err.message || 'Failed to save document.', 'error');
    }
  }, [showToast]);

  const handleDeleteDocument = useCallback((id) => {
    handleUpdateDocStatus(id, 'trash');
    showToast?.('Document moved to trash.', 'info');
  }, [showToast]);

  const handleDeletePermanently = useCallback(async (id) => {
    setAllDocs((prev) => prev.filter((d) => d.id !== id));
    try {
      await deleteDocument(id);
      showToast?.('Document permanently deleted.', 'success');
    } catch (err) {
      showToast?.(err.message || 'Failed to delete document.', 'error');
    }
  }, [showToast]);

  const handleEmptyTrash = useCallback(async () => {
    const trashIds = allDocs.filter((d) => d.status === 'trash').map((d) => d.id);
    setAllDocs((prev) => prev.filter((d) => d.status !== 'trash'));
    const results = await Promise.allSettled(trashIds.map((id) => deleteDocument(id)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      showToast?.(`${failed} item(s) could not be deleted.`, 'warning');
    } else {
      showToast?.('Trash emptied successfully.', 'success');
    }
  }, [allDocs, showToast]);

  const handleUpdateDocStatus = useCallback(async (id, newStatus) => {
    const docToUpdate = allDocs.find((d) => d.id === id);
    if (!docToUpdate) return;
    const updatedDoc = { ...docToUpdate, status: newStatus };
    setAllDocs((prev) => prev.map((d) => (d.id === id ? updatedDoc : d)));
    try {
      await updateDocument(id, { status: newStatus });
    } catch (err) {
      // Roll back
      setAllDocs((prev) => prev.map((d) => (d.id === id ? docToUpdate : d)));
      showToast?.(err.message || 'Failed to update document.', 'error');
    }
  }, [allDocs, showToast]);

  const handleRowClick = (doc) => {
    setSelectedDoc(doc);
    setCurrentSubView('editor');
  };

  const handleEditDocument = (doc) => {
    setSelectedDoc(doc);
    setCurrentSubView('editor');
  };

  const handleActionClick = (actionName) => {
    if (actionName === 'Create Quotation') {
      setCurrentSubView('quotation');
    } else if (actionName === 'More') {
      setActiveTab('Document');
      setCurrentSubView(null);
    } else {
      showToast?.(`${actionName} coming soon!`, 'info');
    }
  };

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setCurrentSubView(null);
    setSearchQuery('');
    setSelectedDoc(null);
  };

  // ── Derived Data ──────────────────────────────────────────────────────────

  const activeDocs = allDocs.filter((d) => d.status === 'active');
  const trashDocs = allDocs.filter((d) => d.status === 'trash');

  const filterDocs = (docs) => docs.filter(
    (d) =>
      d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDocs = filterDocs(activeDocs);
  const filteredTrash = filterDocs(trashDocs);
  const filteredQuotationDocs = filteredDocs.filter(
    (d) => d.type === 'Quotation' || d.name?.toLowerCase().includes('quotation')
  );

  // ── Topbar title ──────────────────────────────────────────────────────────

  const topbarTitle = currentSubView === 'editor'
    ? selectedDoc?.name || 'Document Editor'
    : currentSubView === 'template_editor'
    ? 'Template Editor'
    : currentSubView === 'quotation'
    ? 'Quotation'
    : activeTab;

  // ── Render ────────────────────────────────────────────────────────────────

  const renderContent = () => {
    if (dataLoading) return <LoadingSkeleton />;
    if (dataError) {
      return (
        <div className="dashboard-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px' }}>
          <p style={{ color: '#EF4444', fontWeight: '500' }}>{dataError}</p>
          <button onClick={() => window.location.reload()} style={{ padding: '10px 24px', background: '#6C2BD9', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
            Refresh
          </button>
        </div>
      );
    }

    if (currentSubView === 'editor') {
      return <EditorView doc={selectedDoc} onBack={() => setCurrentSubView(null)} logo={companyLogos[0]?.url} />;
    }
    if (currentSubView === 'template_editor') {
      return <TemplateEditorView onBack={() => setCurrentSubView(null)} docName="Recruitment Template" />;
    }
    if (currentSubView === 'quotation') {
      return (
        <QuotationView
          docs={filteredQuotationDocs}
          onBack={() => setCurrentSubView(null)}
          onSelectTemplate={(doc) => { setSelectedDoc(doc); setCurrentSubView('editor'); }}
          onCreateNewTemplate={() => setCurrentSubView('template_editor')}
          searchQuery={searchQuery}
        />
      );
    }

    switch (activeTab) {
      case 'Dashboard':
        return (
          <DashboardHome
            docs={filteredDocs.slice(0, 10)}
            onActionClick={handleActionClick}
            onRowClick={handleRowClick}
            onDeleteDoc={handleDeleteDocument}
            onEditDoc={handleEditDocument}
          />
        );
      case 'Document':
        return (
          <DocumentView
            docs={filteredDocs}
            searchQuery={searchQuery}
            onActionClick={handleActionClick}
            onRowClick={handleRowClick}
            onDeleteDocument={handleDeleteDocument}
            onEditDocument={handleEditDocument}
          />
        );
      case 'AI Extract':
        return <ExtractionView showToast={showToast} />;
      case 'Template':
        return (
          <TemplateView
            templates={activeDocs}
            onAddTemplate={handleAddDocument}
            onDeleteTemplate={handleDeleteDocument}
            onEditTemplate={handleEditDocument}
          />
        );
      case 'My Profile':
        return (
          <ProfileView
            savedData={profileData}
            onUpdateProfile={handleUpdateProfile}
            companyLogos={companyLogos}
            onUpdateLogos={handleUpdateLogos}
            showToast={showToast}
          />
        );
      case 'Trash':
        return (
          <TrashView
            docs={filteredTrash}
            onRestore={(id) => handleUpdateDocStatus(id, 'active')}
            onDeletePermanently={handleDeletePermanently}
            onEmptyTrash={handleEmptyTrash}
            showToast={showToast}
          />
        );
      case 'Mail Center':
        return <MailCenterView showToast={showToast} />;
      default:
        return (
          <div className="dashboard-content">
            <h3 style={{ color: '#9CA3AF' }}>{activeTab} — Coming soon</h3>
          </div>
        );
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar
        activeTab={activeTab}
        onTabClick={handleTabClick}
        onLogout={onLogout}
        currentUser={currentUser}
      />
      <div className="main-content">
        <Topbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          title={topbarTitle}
          profileData={profileData}
        />
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', display: 'flex', flexDirection: 'column', background: currentSubView === 'editor' ? '#FFFFFF' : 'transparent' }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
