export const FAULT_REMINDER_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes

export function identifyAlarmsToNotify(incomingAlarms = [], notifiedMap = {}, now = Date.now()) {
  const toNotify = [];
  const updatedNotifiedMap = { ...notifiedMap };

  for (const alarm of incomingAlarms) {
    const lastNotified = notifiedMap[alarm.id];
    const isFault = alarm.kind === 'FAULT';

    // Notify if never notified before
    if (!lastNotified) {
      toNotify.push(alarm);
      updatedNotifiedMap[alarm.id] = now;
    } else if (isFault && (now - lastNotified) >= FAULT_REMINDER_INTERVAL_MS) {
      // Re-notify active Fault every 60 minutes
      toNotify.push({ ...alarm, isReminder: true });
      updatedNotifiedMap[alarm.id] = now;
    }
  }

  return { toNotify, updatedNotifiedMap };
}

export function deduplicateIncomingAlarms(incomingAlarms = [], seenIds = new Set(), isSubsequentPoll = false) {
  const newAlarms = [];

  for (const alarm of incomingAlarms) {
    if (!seenIds.has(alarm.id)) {
      seenIds.add(alarm.id);
      if (isSubsequentPoll) {
        newAlarms.push(alarm);
      }
    }
  }

  return { newAlarms, seenIds };
}

export function summarizeNotification(newAlarms = []) {
  if (!newAlarms.length) {
    return null;
  }

  const faultCount = newAlarms.filter((a) => a.kind === 'FAULT').length;
  const alertCount = newAlarms.filter((a) => a.kind === 'ALERT').length;
  const hasFault = faultCount > 0;

  if (newAlarms.length === 1) {
    const alarm = newAlarms[0];
    const isFault = alarm.kind === 'FAULT';
    const reminderPrefix = alarm.isReminder ? '[Pengingat 60 mnt] ' : '';
    return {
      variant: isFault ? 'error' : 'warning',
      title: `${isFault ? '🔴 Fault' : 'Alert'} iSolar: ${alarm.dcName || 'DC'}`,
      message: `${reminderPrefix}${alarm.dcName ? `${alarm.dcName}: ` : ''}${alarm.title || 'Gangguan operasional inverter'}${alarm.occurredAt ? ` (${new Date(alarm.occurredAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} WIB)` : ''}`,
      requireInteraction: isFault,
      tag: alarm.id,
      alarm,
    };
  }

  const parts = [];
  if (faultCount > 0) parts.push(`${faultCount} Fault`);
  if (alertCount > 0) parts.push(`${alertCount} Alert`);

  return {
    variant: hasFault ? 'error' : 'warning',
    title: `${hasFault ? '🔴' : '🟠'} ${newAlarms.length} Alarm Baru iSolar Terdeteksi`,
    message: `${parts.join(', ')} pada monitoring PLTS. Buka panel alarm untuk detail.`,
    requireInteraction: hasFault,
    tag: 'isolar-multiple-alarms',
  };
}

export function pruneReadIds(readIdsArray = [], activeIdsSet = new Set(), maxReadIds = 500) {
  const activeRead = [];
  const inactiveRead = [];

  for (const id of readIdsArray) {
    if (activeIdsSet.has(id)) {
      activeRead.push(id);
    } else {
      inactiveRead.push(id);
    }
  }

  // Active read IDs have highest retention priority, followed by most recent inactive ones
  const combined = [...activeRead, ...inactiveRead];
  return combined.slice(0, maxReadIds);
}

export function filterAlarms(alarms = [], filter = 'ALL', readIdsSet = new Set()) {
  switch (filter) {
    case 'FAULT':
      return alarms.filter((a) => a.kind === 'FAULT');
    case 'ALERT':
      return alarms.filter((a) => a.kind === 'ALERT');
    case 'UNREAD':
      return alarms.filter((a) => !readIdsSet.has(a.id));
    case 'ALL':
    default:
      return alarms;
  }
}
