import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  confirmType = 'primary', // 'primary' | 'danger'
  onConfirm,
  onCancel,
  isLoading = false
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {confirmType === 'danger' && <AlertTriangle size={16} color="#C62828" />}
            <span>{title}</span>
          </div>
          <button
            onClick={onCancel}
            type="button"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#707783' }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ color: '#252B35', fontSize: '13px', lineHeight: '1.5' }}>{message}</p>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary btn-sm"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`btn ${confirmType === 'danger' ? 'btn-danger' : 'btn-primary'} btn-sm`}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

