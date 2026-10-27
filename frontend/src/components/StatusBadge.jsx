import React from 'react';
import { CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';

export default function StatusBadge({ status, label }) {
  const norm = (status || '').toUpperCase();
  const text = label || norm;

  if (['ACTIVE', 'PASSED', 'VALID', 'TRUSTED', 'SUCCESS'].includes(norm)) {
    return (
      <span className="badge badge-active">
        <CheckCircle2 size={11} strokeWidth={2.2} />
        <span>{text}</span>
      </span>
    );
  }

  if (['REVOKED', 'FAILED', 'INVALID', 'UNTRUSTED', 'DENIED', 'EXPIRED'].includes(norm)) {
    return (
      <span className="badge badge-revoked">
        <XCircle size={11} strokeWidth={2.2} />
        <span>{text}</span>
      </span>
    );
  }

  if (['PENDING', 'EXPIRING', 'WARNING', 'CUSTOM'].includes(norm)) {
    return (
      <span className="badge badge-pending">
        <AlertCircle size={11} strokeWidth={2.2} />
        <span>{text}</span>
      </span>
    );
  }

  return (
    <span className="badge badge-neutral">
      <span>{text}</span>
    </span>
  );
}

