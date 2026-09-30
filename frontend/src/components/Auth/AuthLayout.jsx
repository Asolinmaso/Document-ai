import React from 'react';
import { FileText, Sparkles, ShieldCheck, Mail } from 'lucide-react';

const FEATURES = [
  { icon: <FileText size={16} />, text: 'Create quotations from reusable templates' },
  { icon: <Sparkles size={16} />, text: 'Extract data from documents with AI' },
  { icon: <Mail size={16} />, text: 'Send finished documents straight from the app' },
  { icon: <ShieldCheck size={16} />, text: 'Your documents, securely stored' },
];

const Logo = () => (
  <>
    <span className="auth-logo-mark"><FileText size={20} /></span>
    DocAI
  </>
);

/** Shared shell for every signed-out screen: brand panel (desktop) + centered form card. */
const AuthLayout = ({ title, subtitle, children, footer }) => (
  <div className="auth-page">
    <aside className="auth-brand" aria-hidden="true">
      <div className="auth-logo"><Logo /></div>
      <div className="auth-brand-copy">
        <h2>Documents that write themselves.</h2>
        <p>Build, manage and send professional business documents in minutes.</p>
      </div>
      <ul className="auth-features">
        {FEATURES.map((f) => (
          <li key={f.text}><span className="auth-feature-icon">{f.icon}</span>{f.text}</li>
        ))}
      </ul>
    </aside>

    <main className="auth-main">
      <div className="auth-card">
        <div className="auth-mobile-logo"><Logo /></div>
        <div className="auth-heading">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {children}
        {footer && <div className="auth-footer">{footer}</div>}
      </div>
    </main>
  </div>
);

export default AuthLayout;
