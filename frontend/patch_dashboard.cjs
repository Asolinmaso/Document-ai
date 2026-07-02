const fs = require('fs');

let content = fs.readFileSync('src/components/Dashboard/Dashboard.jsx', 'utf8');

// 1. Add ExtractionView import
content = content.replace(/import MailCenterView from '.\/MailCenterView';/, "import MailCenterView from './MailCenterView';\nimport ExtractionView from './ExtractionView';");

// 2. Add Sparkles icon import
content = content.replace(/  Edit\n} from 'lucide-react';/, "  Edit,\n  Sparkles\n} from 'lucide-react';");

// 3. Add AI Extract to Sidebar
content = content.replace(/\{ name: 'Document', icon: <FileText size=\{18\} \/> \},/, "{ name: 'Document', icon: <FileText size={18} /> },\n    { name: 'AI Extract', icon: <Sparkles size={18} /> },");

// 4. Add case in renderView (Dashboard component returns)
content = content.replace(/          \) : activeTab === 'Template' \? \(/, `          ) : activeTab === 'AI Extract' ? (
            <ExtractionView />
          ) : activeTab === 'Template' ? (`);

// 5. Update Profile Topbar hardcoded strings
content = content.replace(/<p style=\{\{ fontSize: '13px', fontWeight: '700', margin: 0, letterSpacing: '0\.2px' \}\}>Manvian Business<\/p>\n\s*<p style=\{\{ fontSize: '13px', fontWeight: '700', margin: 0, letterSpacing: '0\.2px' \}\}>Solutions<\/p>/, 
  "<p style={{ fontSize: '13px', fontWeight: '700', margin: 0, letterSpacing: '0.2px' }}>{profileData?.companyName || 'DocAI'}</p>");
content = content.replace(/const Topbar = \(\{ searchQuery, onSearchChange, activeTab \}\) => \{/, "const Topbar = ({ searchQuery, onSearchChange, activeTab, profileData }) => {");

// 6. Pass profileData to Topbar
content = content.replace(/<Topbar searchQuery=\{searchQuery\} onSearchChange=\{searchQuery\} activeTab=\{currentSubView \? 'Quotation' : activeTab\} \/>/g, "<Topbar searchQuery={searchQuery} onSearchChange={setSearchQuery} activeTab={currentSubView ? 'Quotation' : activeTab} profileData={profileData} />");
content = content.replace(/<Topbar searchQuery=\{searchQuery\} onSearchChange=\{setSearchQuery\} activeTab=\{currentSubView \? 'Quotation' : activeTab\} \/>/g, "<Topbar searchQuery={searchQuery} onSearchChange={setSearchQuery} activeTab={currentSubView ? 'Quotation' : activeTab} profileData={profileData} />");

// 7. Fix fetch with token headers
content = content.replace(/fetch\('\/api\/documents'\)/g, "fetch('/api/documents', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })");
content = content.replace(/fetch\('\/api\/profile'\)/g, "fetch('/api/profile', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })");
content = content.replace(/fetch\('\/api\/logos'\)/g, "fetch('/api/logos', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })");
content = content.replace(/fetch\('\/api\/profile', \{/g, "fetch('/api/profile', {\n        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },");
content = content.replace(/headers: \{ 'Content-Type': 'application\/json' \},/g, ""); // Remove the duplicate headers if they existed

content = content.replace(/fetch\('\/api\/documents', \{/g, "fetch('/api/documents', {\n        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },");
content = content.replace(/fetch\(`\/api\/documents\/\$\{id\}`/g, "fetch(`/api/documents/${id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }");

// And replace DocumentView rendering to pass Delete/Edit
content = content.replace(/<DocumentView docs=\{filteredDocs\} searchQuery=\{searchQuery\} onSearchChange=\{setSearchQuery\} onActionClick=\{handleActionClick\} onRowClick=\{handleRowClick\} \/>/, `<DocumentView docs={filteredDocs} searchQuery={searchQuery} onSearchChange={setSearchQuery} onActionClick={handleActionClick} onRowClick={handleRowClick} onDeleteDocument={handleDeleteDocument} onEditDocument={handleEditDocument} />`);

fs.writeFileSync('src/components/Dashboard/Dashboard.jsx', content);
console.log('Dashboard.jsx patched successfully!');
