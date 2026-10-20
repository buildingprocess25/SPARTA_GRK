'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import { ConfirmContext, useConfirmContext } from './ConfirmContext';

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    if (resolverRef.current) resolverRef.current(false);
    resolverRef.current = resolve;
    setRequest({ options, loading: false });
  }), []);

  const settle = useCallback((result) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setRequest(null);
  }, []);

  const value = useMemo(() => confirm, [confirm]);
  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={Boolean(request)}
        options={request?.options}
        loading={request?.loading}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useConfirmContext();
  if (!confirm) throw new Error('useConfirm must be used within ConfirmProvider');
  return confirm;
}
