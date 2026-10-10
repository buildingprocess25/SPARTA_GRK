'use client';

/**
 * Browser-side Web Push subscription helpers. Pairs with public/sw.js
 * (service worker) and src/lib/push.js (server-side sending).
 */

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

/**
 * Registers the service worker, requests Notification permission, creates a
 * push subscription, and saves it server-side.
 * @returns {Promise<'granted'|'denied'|'unsupported'|'not_configured'|'error'>}
 */
export async function enablePushNotifications() {
  if (!isPushSupported()) return 'unsupported';

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) return 'not_configured';

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return permission;

    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    if (!res.ok) return 'error';

    return 'granted';
  } catch (err) {
    console.warn('[pushClient] Gagal mengaktifkan push notification:', err);
    return 'error';
  }
}

export async function disablePushNotifications() {
  if (!isPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('[pushClient] Gagal menonaktifkan push notification:', err);
  }
}

export async function getExistingPushSubscription() {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!registration) return null;
    return await registration.pushManager.getSubscription();
  } catch (_) {
    return null;
  }
}
