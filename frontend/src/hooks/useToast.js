import { useState, useCallback } from 'react';

let toastId = 0;

/**
 * useToast – lightweight, accessible toast notification system.
 *
 * Usage:
 *   const { toasts, showToast } = useToast();
 *   showToast('Saved!', 'success');
 *   showToast('Something went wrong.', 'error');
 *
 * Then render <ToastContainer toasts={toasts} /> somewhere near the root.
 */
export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, removeToast };
};
