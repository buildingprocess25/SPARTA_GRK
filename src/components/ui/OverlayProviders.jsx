'use client';

import { ConfirmProvider } from './ConfirmProvider';
import { ToastProvider } from './ToastProvider';

export default function OverlayProviders({ children }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}
