'use client';

import { ConfirmProvider } from './ConfirmProvider';
import { ToastProvider } from './ToastProvider';
import { AlarmProvider } from '@/context/AlarmContext';
import AlarmDialog from '@/components/alarms/AlarmDialog';
import SessionCutoffGuard from '@/components/SessionCutoffGuard';

export default function OverlayProviders({ children }: { children?: any }) {
  return (
    <ToastProvider>
      <AlarmProvider>
        <ConfirmProvider>
          {children}
          <AlarmDialog />
          <SessionCutoffGuard />
        </ConfirmProvider>
      </AlarmProvider>
    </ToastProvider>
  );
}
