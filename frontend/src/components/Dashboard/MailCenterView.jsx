import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Trash2, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  Inbox,
  Send,
  File,
  Clock,
  Trash,
  X,
  Paperclip,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Link,
  RemoveFormatting,
  RotateCcw,
  Reply,
  Forward,
  Download,
  ChevronDown
} from 'lucide-react';

const MailCenterView = () => {
  const [activeFolder, setActiveFolder] = useState('Inbox');
  const [emails, setEmails] = useState([]);
  const [viewingEmail, setViewingEmail] = useState(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeData, setComposeData] = useState({ to: '', cc: '', bcc: '', subject: '', body: '', attachments: [] });
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const editorRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedEmailIds, setSelectedEmailIds] = useState([]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleData, setScheduleData] = useState({ date: '', time: '', timezone: '' });
  const [isSyncing, setIsSyncing] = useState(false);

  // Load emails from DB on mount
  const loadEmails = () => {
    fetch('/api/mail')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setEmails(data); })
      .catch(err => console.error('Failed to load emails:', err));
  };

  useEffect(() => {
    loadEmails();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/mail/sync');
      const data = await response.json();
      if (data.success) {
        if (data.synced > 0) alert(`Synced ${data.synced} new emails from Gmail!`);
        loadEmails();
      } else {
        alert(data.error || 'Failed to sync emails');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to sync server');
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleSelection = (id) => {
    if (selectedEmailIds.includes(id)) {
      setSelectedEmailIds(selectedEmailIds.filter(eId => eId !== id));
    } else {
      setSelectedEmailIds([...selectedEmailIds, id]);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedEmailIds.length === 0) return;
    if (activeFolder === 'Trash') {
      await Promise.all(selectedEmailIds.map(id => fetch(`/api/mail/${id}`, { method: 'DELETE' })));
      setEmails(emails.filter(email => !selectedEmailIds.includes(email.id)));
    } else {
      await Promise.all(selectedEmailIds.map(id =>
        fetch(`/api/mail/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: 'Trash' }) })
      ));
      setEmails(emails.map(email => selectedEmailIds.includes(email.id) ? { ...email, folder: 'Trash' } : email));
    }
    setSelectedEmailIds([]);
  };

  const handleRestoreSelected = async () => {
    if (selectedEmailIds.length === 0) return;
    await Promise.all(selectedEmailIds.map(id =>
      fetch(`/api/mail/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: 'Inbox' }) })
    ));
    setEmails(emails.map(email => selectedEmailIds.includes(email.id) ? { ...email, folder: 'Inbox' } : email));
    setSelectedEmailIds([]);
  };

  const handleEmptyTrash = async () => {
    const trashIds = emails.filter(e => e.folder === 'Trash').map(e => e.id);
    await Promise.all(trashIds.map(id => fetch(`/api/mail/${id}`, { method: 'DELETE' })));
    setEmails(emails.filter(email => email.folder !== 'Trash'));
    setSelectedEmailIds([]);
  };

  const handleRestore = async (id) => {
    await fetch(`/api/mail/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: 'Inbox' }) });
    setEmails(emails.map(email => email.id === id ? { ...email, folder: 'Inbox' } : email));
    setSelectedEmailIds(selectedEmailIds.filter(eId => eId !== id));
  };

  const handlePermanentDelete = async (id) => {
    await fetch(`/api/mail/${id}`, { method: 'DELETE' });
    setEmails(emails.filter(email => email.id !== id));
    setSelectedEmailIds(selectedEmailIds.filter(eId => eId !== id));
  };

  const handleFormat = (e, command, value = null) => {
    if (e) e.preventDefault();
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
      setComposeData({...composeData, body: editorRef.current.innerHTML});
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setComposeData(prev => ({
          ...prev,
          attachments: [...(prev.attachments || []), { name: file.name, contentType: file.type, content: reader.result }]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleReply = () => {
    setComposeData({
      to: viewingEmail.sender.includes('<') ? viewingEmail.sender.split('<')[1].replace('>', '') : viewingEmail.sender,
      cc: '', bcc: '',
      subject: viewingEmail.subject.startsWith('Re:') ? viewingEmail.subject : `Re: ${viewingEmail.subject}`,
      body: `<br><br><div style="border-left: 2px solid #ccc; padding-left: 10px; color: #666;">On ${viewingEmail.time}, ${viewingEmail.sender.replace(/</g, '&lt;').replace(/>/g, '&gt;')} wrote:<br>${viewingEmail.body || viewingEmail.snippet}</div>`,
      attachments: []
    });
    setViewingEmail(null);
    setIsComposeOpen(true);
  };

  const handleForward = () => {
    let atts = viewingEmail.attachments;
    if (typeof atts === 'string') { try { atts = JSON.parse(atts); } catch(e) { atts = []; } }
    
    setComposeData({
      to: '', cc: '', bcc: '',
      subject: viewingEmail.subject.startsWith('Fwd:') ? viewingEmail.subject : `Fwd: ${viewingEmail.subject}`,
      body: `<br><br><div style="border-left: 2px solid #ccc; padding-left: 10px; color: #666;">---------- Forwarded message ---------<br>From: ${viewingEmail.sender.replace(/</g, '&lt;').replace(/>/g, '&gt;')}<br>Date: ${viewingEmail.time}<br>Subject: ${viewingEmail.subject}<br>To: ${viewingEmail.recipient}<br><br>${viewingEmail.body || viewingEmail.snippet}</div>`,
      attachments: atts || []
    });
    setViewingEmail(null);
    setIsComposeOpen(true);
  };

  const handleDeleteFromViewer = async () => {
    if (activeFolder === 'Trash') {
      await handlePermanentDelete(viewingEmail.id);
    } else {
      await fetch(`/api/mail/${viewingEmail.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: 'Trash' }) });
      setEmails(emails.map(email => email.id === viewingEmail.id ? { ...email, folder: 'Trash' } : email));
    }
    setViewingEmail(null);
  };

  const handleSend = async (folderName = 'Sent') => {
    const toStr = composeData.to || '';
    const ccStr = composeData.cc || '';
    const bccStr = composeData.bcc || '';
    const subjectStr = composeData.subject || '';
    const bodyStr = composeData.body || '';

    if (!toStr.trim() && folderName === 'Sent') {
      alert("Please specify a recipient.");
      return;
    }

    if (folderName === 'Sent') {
      try {
        const response = await fetch('/api/mail/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: toStr,
            cc: ccStr,
            bcc: bccStr,
            subject: subjectStr,
            body: bodyStr,
            attachments: composeData.attachments
          })
        });
        const data = await response.json();
        
        if (data.success) {
          if (data.previewUrl) {
            console.log("Ethereal Preview URL: ", data.previewUrl);
            alert(`Email sent successfully!\n\n(No SMTP configured. View the fake email here:\n${data.previewUrl})`);
          } else {
            alert('Email sent successfully!');
          }
        } else {
          throw new Error(data.error || 'Failed to send email');
        }
      } catch (err) {
        console.error(err);
        alert('Failed to send email. Check console for details.');
        return; // Don't add to sent folder if it failed
      }
    }

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = bodyStr;
    const plainTextBody = tempDiv.textContent || tempDiv.innerText || "";

    const newEmail = {
      id: Date.now(),
      folder: folderName,
      sender: folderName === 'Draft' ? '(Draft)' : 'Me (To: ' + toStr.trim() + ')',
      recipient: toStr.trim(),
      subject: subjectStr.trim() || '(No Subject)',
      snippet: plainTextBody.trim().substring(0, 50) || '(Empty message)',
      body: bodyStr,
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      attachments: composeData.attachments
    };

    try {
      await fetch('/api/mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmail)
      });
    } catch (err) {
      console.error('Failed to save email to database:', err);
    }

    setEmails(prevEmails => [newEmail, ...prevEmails]);
    setIsComposeOpen(false);
    setComposeData({ to: '', cc: '', bcc: '', subject: '', body: '' });
    setShowCc(false);
    setShowBcc(false);
    if (editorRef.current) editorRef.current.innerHTML = '';
    setActiveFolder(folderName);
    setCurrentPage(1);
    setSelectedEmailIds([]);
  };

  const folders = [
    { name: 'Inbox', icon: <Inbox size={18} />, count: emails.filter(e => e.folder === 'Inbox').length },
    { name: 'Sent', icon: <Send size={18} />, count: emails.filter(e => e.folder === 'Sent').length },
    { name: 'Draft', icon: <File size={18} />, count: emails.filter(e => e.folder === 'Draft').length },
    { name: 'Scheduled', icon: <Clock size={18} />, count: emails.filter(e => e.folder === 'Scheduled').length },
    { name: 'Trash', icon: <Trash size={18} />, count: emails.filter(e => e.folder === 'Trash').length },
  ];

  const filteredEmails = emails.filter(email => email.folder === activeFolder);
  const totalPages = Math.ceil(filteredEmails.length / itemsPerPage) || 1;
  const displayedEmails = filteredEmails.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', background: '#F9FAFB', fontFamily: '"Inter", sans-serif' }}>
      
      {/* Left Sidebar (Folders) */}
      <div style={{ 
        width: '260px', 
        background: 'white', 
        borderRight: '1px solid #E5E7EB', 
        padding: '24px 20px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <button 
          onClick={() => setIsComposeOpen(true)}
          style={{ 
          background: '#6C2BD9', 
          color: 'white', 
          border: 'none', 
          padding: '12px', 
          borderRadius: '8px', 
          fontSize: '14px', 
          fontWeight: '600', 
          cursor: 'pointer',
          marginBottom: '32px',
          boxShadow: '0 4px 6px rgba(108, 43, 217, 0.2)'
        }}>
          Compose Email
        </button>

        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#111827', margin: '0 0 16px 0' }}>Folders</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {folders.map(folder => {
            const isActive = activeFolder === folder.name;
            return (
              <div 
                key={folder.name}
                onClick={() => {
                  setActiveFolder(folder.name);
                  setCurrentPage(1);
                  setSelectedEmailIds([]);
                  setViewingEmail(null);
                  setIsComposeOpen(false);
                }}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  background: isActive ? '#F5F3FF' : 'transparent',
                  color: isActive ? '#6C2BD9' : '#4B5563',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ color: isActive ? '#6C2BD9' : '#9CA3AF' }}>
                    {folder.icon}
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: isActive ? '600' : '500' }}>{folder.name}</span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: '500', color: isActive ? '#6C2BD9' : '#9CA3AF' }}>
                  {folder.count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Content Area (Email List) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white' }}>
        
        {isComposeOpen ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white' }}>
            {/* Compose Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 30px', borderBottom: '1px solid #E5E7EB' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button 
                  onClick={() => setIsComposeOpen(false)} 
                  style={{ background: '#6C2BD9', borderRadius: '50%', color: 'white', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', paddingRight: '2px' }}>
                   <ChevronLeft size={22} />
                </button>
                <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>Compose Email</h2>
              </div>
              
              <div style={{ display: 'flex', gap: '16px' }}>
                <button onClick={() => setIsScheduleModalOpen(true)} style={{ border: '1.5px solid #6C2BD9', color: '#6C2BD9', background: 'white', padding: '10px 20px', borderRadius: '8px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>Schedule</button>
                <button onClick={() => handleSend('Draft')} style={{ border: '1.5px solid #6C2BD9', color: '#6C2BD9', background: 'white', padding: '10px 20px', borderRadius: '8px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>Save As Draft</button>
                <button onClick={() => handleSend('Sent')} style={{ background: '#6C2BD9', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>Send Email</button>
              </div>
            </div>

            {/* Compose Form */}
            <div style={{ padding: '0 30px', display: 'flex', flexDirection: 'column', flex: 1 }}>
              
              <div style={{ padding: '24px 0 16px 0', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <span style={{ fontWeight: '700', color: '#111827', fontSize: '16px' }}>To :</span>
                  <input 
                    value={composeData.to} 
                    onChange={e => setComposeData({...composeData, to: e.target.value})} 
                    type="text" 
                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: '15px' }} 
                  />
                </div>
                <div style={{ color: '#4B5563', fontSize: '14px', display: 'flex', gap: '16px' }}>
                   <span style={{ cursor: 'pointer', fontWeight: showCc ? '700' : '400', color: showCc ? '#6C2BD9' : '#4B5563' }} onClick={() => setShowCc(!showCc)}>Cc</span>
                   <span style={{ cursor: 'pointer', fontWeight: showBcc ? '700' : '400', color: showBcc ? '#6C2BD9' : '#4B5563' }} onClick={() => setShowBcc(!showBcc)}>Bcc</span>
                </div>
              </div>

              {showCc && (
                <div style={{ padding: '16px 0', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontWeight: '700', color: '#111827', fontSize: '16px' }}>Cc :</span>
                  <input 
                    value={composeData.cc} 
                    onChange={e => setComposeData({...composeData, cc: e.target.value})} 
                    type="text" 
                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: '15px' }} 
                  />
                </div>
              )}

              {showBcc && (
                <div style={{ padding: '16px 0', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontWeight: '700', color: '#111827', fontSize: '16px' }}>Bcc :</span>
                  <input 
                    value={composeData.bcc} 
                    onChange={e => setComposeData({...composeData, bcc: e.target.value})} 
                    type="text" 
                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: '15px' }} 
                  />
                </div>
              )}
              
              <div style={{ padding: '24px 0 16px 0', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontWeight: '700', color: '#111827', fontSize: '16px' }}>Subject :</span>
                <input 
                  value={composeData.subject} 
                  onChange={e => setComposeData({...composeData, subject: e.target.value})} 
                  type="text" 
                  style={{ flex: 1, border: 'none', outline: 'none', fontSize: '15px' }} 
                />
              </div>

              {/* Attached Files */}
              {composeData.attachments && composeData.attachments.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', padding: '16px 0', borderBottom: '1px solid #E5E7EB', flexWrap: 'wrap' }}>
                  {composeData.attachments.map((att, idx) => (
                    <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#F3F4F6', padding: '6px 12px', borderRadius: '16px', fontSize: '13px', color: '#4B5563' }}>
                      <Paperclip size={12} /> {att.name}
                      <X size={14} style={{ cursor: 'pointer' }} onClick={() => setComposeData({...composeData, attachments: composeData.attachments.filter((_, i) => i !== idx)})} />
                    </div>
                  ))}
                </div>
              )}
              
              {/* Toolbar Inline */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '24px 0', background: 'white' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span onMouseDown={(e) => handleFormat(e, 'bold')} style={{ fontWeight: '800', fontSize: '17px', cursor: 'pointer', color: '#111827', fontFamily: 'serif' }}>B</span>
                  <span onMouseDown={(e) => handleFormat(e, 'italic')} style={{ fontStyle: 'italic', fontWeight: '700', fontSize: '17px', cursor: 'pointer', color: '#111827', fontFamily: 'serif' }}>I</span>
                  <span onMouseDown={(e) => handleFormat(e, 'underline')} style={{ textDecoration: 'underline', fontWeight: '600', fontSize: '17px', cursor: 'pointer', color: '#111827' }}>U</span>
                  <span onMouseDown={(e) => handleFormat(e, 'strikeThrough')} style={{ textDecoration: 'line-through', fontWeight: '500', fontSize: '17px', cursor: 'pointer', color: '#111827' }}>S</span>
                  
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#111827', position: 'relative' }}>
                    <span style={{ fontWeight: '600', fontSize: '17px', borderBottom: '2px solid #111827', paddingBottom: '1px' }}>A</span>
                    <span style={{ fontSize: '10px', marginLeft: '2px', color: '#6B7280' }}>▼</span>
                    <input 
                      type="color" 
                      onChange={(e) => handleFormat(null, 'foreColor', e.target.value)}
                      style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} 
                    />
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#374151' }}>
                  <AlignLeft onMouseDown={(e) => handleFormat(e, 'justifyLeft')} size={20} style={{ cursor: 'pointer' }} />
                  <AlignCenter onMouseDown={(e) => handleFormat(e, 'justifyCenter')} size={20} style={{ cursor: 'pointer' }} />
                  <AlignRight onMouseDown={(e) => handleFormat(e, 'justifyRight')} size={20} style={{ cursor: 'pointer' }} />
                  <AlignJustify onMouseDown={(e) => handleFormat(e, 'justifyFull')} size={20} style={{ cursor: 'pointer' }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: '#374151' }}>
                  <List onMouseDown={(e) => handleFormat(e, 'insertUnorderedList')} size={20} style={{ cursor: 'pointer' }} />
                  <ListOrdered onMouseDown={(e) => handleFormat(e, 'insertOrderedList')} size={20} style={{ cursor: 'pointer' }} />
                  <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', margin: 0 }}>
                    <Paperclip size={18} />
                    <input type="file" multiple style={{ display: 'none' }} onChange={handleFileUpload} />
                  </label>
                  <Link onMouseDown={(e) => {
                    e.preventDefault();
                    const url = prompt('Enter link URL:');
                    if (url) handleFormat(null, 'createLink', url);
                  }} size={19} style={{ cursor: 'pointer' }} />
                  <RemoveFormatting onMouseDown={(e) => handleFormat(e, 'removeFormat')} size={20} style={{ cursor: 'pointer' }} />
                </div>
              </div>

              {/* Text Area */}
              <div 
                ref={editorRef}
                contentEditable
                onInput={e => setComposeData({...composeData, body: e.currentTarget.innerHTML})}
                style={{ 
                  flex: 1, 
                  border: 'none', 
                  outline: 'none', 
                  fontSize: '14px', 
                  color: '#4B5563', 
                  paddingTop: '16px', 
                  overflowY: 'auto',
                  minHeight: '250px'
                }}
              ></div>
            </div>
          </div>
        ) : viewingEmail ? (
          // Email Viewer View
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#FAFAFA' }}>
             {/* Header */}
             <div style={{ display: 'flex', justifyContent: 'space-between', padding: '24px 32px', borderBottom: '1px solid #E5E7EB', background: '#FFFFFF' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', color: '#111827', fontWeight: '700', fontSize: '18px' }} onClick={() => setViewingEmail(null)}>
                 <div style={{ background: '#6C2BD9', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                   <ChevronLeft size={20} />
                 </div>
                 Back
               </div>
               <div style={{ display: 'flex', gap: '24px', color: '#6B7280', fontSize: '13px', fontWeight: '500' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }} onClick={handleReply}><Reply size={16} /> Reply</div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }} onClick={handleForward}><Forward size={16} /> Forward</div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }} onClick={handleDeleteFromViewer}><Trash2 size={16} /> Delete</div>
               </div>
             </div>
             
             {/* Email Content */}
             <div style={{ padding: '32px', flex: 1, overflowY: 'auto' }}>
               <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: '0 0 32px 0' }}>{viewingEmail.subject}</h1>
               
               {/* Sender Info */}
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                 <div style={{ display: 'flex', gap: '16px' }}>
                   <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#6C2BD9', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '600' }}>
                     {viewingEmail.sender ? viewingEmail.sender.substring(0, 2).toUpperCase() : 'ME'}
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                     <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827' }}>{viewingEmail.sender}</div>
                     <div style={{ fontSize: '13px', color: '#6B7280' }}>
                       {viewingEmail.sender.includes('@') ? viewingEmail.sender : 'sender@example.com'}
                       <br />
                       To me <ChevronDown size={12} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: '4px' }} />
                     </div>
                   </div>
                 </div>
                 <div style={{ fontSize: '13px', color: '#6B7280' }}>
                   {viewingEmail.time}
                 </div>
               </div>
               
               {/* Body */}
               <div style={{ fontSize: '15px', color: '#4B5563', lineHeight: '1.8', whiteSpace: 'pre-wrap', marginBottom: '48px' }} dangerouslySetInnerHTML={{ __html: viewingEmail.body || viewingEmail.snippet }} />
               
               {/* Attachments */}
               {(() => {
                 let atts = viewingEmail.attachments;
                 if (typeof atts === 'string') {
                   try { atts = JSON.parse(atts); } catch(e) { atts = []; }
                 }
                 if (!atts || atts.length === 0) return null;
                 return (
                   <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '32px' }}>
                     <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: '0 0 20px 0' }}>Attachments ({atts.length < 10 ? '0' : ''}{atts.length})</h3>
                     {atts.map((att, idx) => (
                       <div key={idx} onClick={() => {
                          const link = document.createElement('a');
                          link.href = att.content && att.content.startsWith('data:') ? att.content : `data:${att.contentType || 'application/octet-stream'};base64,${att.content}`;
                          link.download = att.name || 'attachment';
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                       }} style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', background: '#D8B4FE', padding: '12px 20px', borderRadius: '8px', color: '#4C1D95', fontWeight: '500', fontSize: '14px', cursor: 'pointer', marginRight: '12px', marginBottom: '12px' }}>
                         {att.name} <Download size={16} />
                       </div>
                     ))}
                   </div>
                 );
               })()}
             </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: '20px 24px', 
              borderBottom: '1px solid #E5E7EB' 
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: 0 }}>
                {activeFolder} ({filteredEmails.length})
              </h2>
              
              {activeFolder === 'Trash' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                    <input 
                      type="text" 
                      placeholder="Search Mail.." 
                      style={{ 
                        padding: '8px 12px 8px 36px', 
                        borderRadius: '6px', 
                        border: '1px solid #D1D5DB', 
                        fontSize: '13px', 
                        width: '200px',
                        outline: 'none'
                      }} 
                    />
                  </div>
                  
                  <button 
                    onClick={handleRestoreSelected}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1.5px solid #6C2BD9', background: 'white', color: '#6C2BD9', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    <RotateCcw size={16} /> Restore Selected
                  </button>
                  
                  <button 
                    onClick={handleEmptyTrash}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', border: 'none', background: '#EF4444', color: 'white', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    <Trash2 size={16} /> Empty Trash
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                    <input 
                      type="text" 
                      placeholder="Search Mail.." 
                      style={{ 
                        padding: '8px 12px 8px 36px', 
                        borderRadius: '6px', 
                        border: '1px solid #D1D5DB', 
                        fontSize: '13px', 
                        width: '240px',
                        outline: 'none'
                      }} 
                    />
                  </div>
                  
                  <Trash2 
                    onClick={handleDeleteSelected}
                    size={18} 
                    style={{ color: selectedEmailIds.length > 0 ? '#EF4444' : '#6B7280', cursor: selectedEmailIds.length > 0 ? 'pointer' : 'default' }} 
                  />
                  <RefreshCw 
                    onClick={() => { setSelectedEmailIds([]); setCurrentPage(1); handleSync(); }}
                    size={18} 
                    style={{ color: '#6B7280', cursor: isSyncing ? 'wait' : 'pointer', animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} 
                  />
                  
                  {/* CSS for spinning animation */}
                  <style>
                    {`
                      @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                      }
                    `}
                  </style>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#4B5563', fontSize: '13px', fontWeight: '500' }}>
                    <span>{filteredEmails.length > 0 ? `${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredEmails.length)} of ${filteredEmails.length}` : '0 of 0'}</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <ChevronLeft 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        size={18} 
                        style={{ cursor: currentPage > 1 ? 'pointer' : 'default', color: currentPage > 1 ? '#4B5563' : '#D1D5DB' }} 
                      />
                      <ChevronRight 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        size={18} 
                        style={{ cursor: currentPage < totalPages ? 'pointer' : 'default', color: currentPage < totalPages ? '#4B5563' : '#D1D5DB' }} 
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Email List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {displayedEmails.map(email => (
                <div 
                  key={email.id}
                  onClick={() => setViewingEmail(email)}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '16px 24px', 
                    borderBottom: '1px solid #F3F4F6',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = '#F9FAFB'}
                  onMouseOut={e => e.currentTarget.style.background = 'white'}
                >
                  <input 
                    type="checkbox" 
                    checked={selectedEmailIds.includes(email.id)}
                    onChange={(e) => { e.stopPropagation(); toggleSelection(email.id); }}
                    style={{ marginRight: '20px', width: '16px', height: '16px', accentColor: '#6C2BD9', cursor: 'pointer' }} 
                  />
                  
                  <div style={{ width: '180px', flexShrink: 0, fontSize: '14px', fontWeight: '600', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '16px' }}>
                    {email.sender}
                  </div>
                  
                  <div style={{ flex: 1, fontSize: '14px', color: '#4B5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '20px' }}>
                    <span style={{ fontWeight: '600', color: '#111827' }}>{email.subject}</span> - {email.snippet}
                  </div>
                  
                  {activeFolder === 'Trash' ? (
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', color: '#6B7280', width: '80px', justifyContent: 'flex-end' }}>
                      <RotateCcw 
                        onClick={(e) => { e.stopPropagation(); handleRestore(email.id); }}
                        size={18} style={{ color: '#6C2BD9', cursor: 'pointer' }} 
                      />
                      <Trash2 
                        onClick={(e) => { e.stopPropagation(); handlePermanentDelete(email.id); }}
                        size={18} style={{ color: '#EF4444', cursor: 'pointer' }} 
                      />
                    </div>
                  ) : (
                    <div style={{ fontSize: '13px', color: '#6B7280', fontWeight: '500', width: '80px', textAlign: 'right' }}>
                      {email.time}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Schedule Email Modal */}
      {isScheduleModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', width: '480px', borderRadius: '16px', padding: '32px', position: 'relative', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <button onClick={() => setIsScheduleModalOpen(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', cursor: 'pointer', color: '#111827' }}>
              <X size={24} />
            </button>
            
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: '0 0 8px 0' }}>Schedule Email</h2>
            <p style={{ fontSize: '15px', color: '#4B5563', margin: '0 0 32px 0' }}>Select date and time to send this email.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', color: '#4B5563', marginBottom: '8px' }}>Select Date</label>
                <input 
                  type="date"
                  value={scheduleData.date}
                  onChange={e => setScheduleData({...scheduleData, date: e.target.value})}
                  style={{ width: '100%', padding: '12px 16px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', outline: 'none', color: '#4B5563', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '14px', color: '#4B5563', marginBottom: '8px' }}>Select Time</label>
                <input 
                  type="time"
                  value={scheduleData.time}
                  onChange={e => setScheduleData({...scheduleData, time: e.target.value})}
                  style={{ width: '100%', padding: '12px 16px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', outline: 'none', color: '#4B5563', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '14px', color: '#4B5563', marginBottom: '8px' }}>Select Time Zone</label>
                <select 
                  value={scheduleData.timezone}
                  onChange={e => setScheduleData({...scheduleData, timezone: e.target.value})}
                  style={{ width: '100%', padding: '12px 16px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', outline: 'none', color: '#4B5563', boxSizing: 'border-box', appearance: 'none', background: 'url("data:image/svg+xml;utf8,<svg fill=\'%239CA3AF\' height=\'20\' viewBox=\'0 0 24 24\' width=\'20\' xmlns=\'http://www.w3.org/2000/svg\'><path d=\'M7 10l5 5 5-5z\'/></svg>") no-repeat right 12px center', backgroundColor: 'white', fontFamily: 'inherit' }}
                >
                  <option value="">Select</option>
                  <option value="EST">Eastern Standard Time (EST)</option>
                  <option value="CST">Central Standard Time (CST)</option>
                  <option value="MST">Mountain Standard Time (MST)</option>
                  <option value="PST">Pacific Standard Time (PST)</option>
                  <option value="IST">Indian Standard Time (IST)</option>
                </select>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '40px' }}>
              <button 
                onClick={() => setIsScheduleModalOpen(false)}
                style={{ padding: '10px 24px', border: '1.5px solid #6C2BD9', borderRadius: '8px', background: 'white', color: '#6C2BD9', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  handleSend('Scheduled');
                  setIsScheduleModalOpen(false);
                }}
                style={{ padding: '10px 24px', border: 'none', borderRadius: '8px', background: '#6C2BD9', color: 'white', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
              >
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default MailCenterView;
