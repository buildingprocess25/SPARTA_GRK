'use client';

import { ConfirmProvider } from './ConfirmProvider';
import { ToastProvider } from './ToastProvider';
import { AlarmProvider } from '@/context/AlarmContext';
import AlarmDialog from '@/components/alarms/AlarmDialog';

export default function OverlayProviders({ children }) {
  return (
    <ToastProvider>
      <AlarmProvider>
        <ConfirmProvider>
          {children}
          <AlarmDialog />
        </ConfirmProvider>
      </AlarmProvider>
    </ToastProvider>
  );
}
