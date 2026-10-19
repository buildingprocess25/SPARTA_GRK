'use client';

import { ConfirmProvider } from './ConfirmProvider';
import { ToastProvider } from './ToastProvider';
import { AlarmProvider } from '@/context/AlarmContext';
import AlarmDialog from '@/components/alarms/AlarmDialog';
import IdleSessionGuard from '@/components/IdleSessionGuard';

export default function OverlayProviders({ children }) {
  return (
    <ToastProvider>
      <AlarmProvider>
        <ConfirmProvider>
          {children}
          <AlarmDialog />
          <IdleSessionGuard />
        </ConfirmProvider>
      </AlarmProvider>
    </ToastProvider>
  );
}
