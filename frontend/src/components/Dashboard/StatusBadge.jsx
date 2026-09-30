import React from 'react';
import { statusMeta } from '../../utils/docs';

const StatusBadge = ({ status }) => {
  const s = statusMeta(status);
  return (
    <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
};

export default StatusBadge;
