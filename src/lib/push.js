/**
 * Server-side Web Push sending (Node runtime only - uses the `web-push`
 * package and Prisma, neither of which run on the Edge). Subscriptions are
 * stored per-device in PushSubscription (see prisma/schema.prisma); one push
 * is fanned out to every stored subscription whenever a new fault/alarm is
 * detected during sync (see src/lib/solar/sync.js).
 */
import webpush from 'web-push';
import prisma from './prisma.js';

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    const err = new Error('VAPID keys belum dikonfigurasi (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).');
    err.code = 'VAPID_NOT_CONFIGURED';
    throw err;
  }
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@alfamart.co.id';
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export function isPushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export async function saveSubscription({ username, subscription, userAgent }) {
  ensureConfigured();
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    throw new Error('Payload subscription tidak lengkap.');
  }

  return prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { username, p256dh, auth, userAgent },
    create: { username, endpoint, p256dh, auth, userAgent },
  });
}

export async function removeSubscriptionByEndpoint(endpoint) {
  if (!endpoint) return;
  await prisma.pushSubscription.deleteMany({ where: { endpoint } }).catch(() => {});
}

/**
 * Fan a push payload out to every stored subscription. Expired/revoked
 * subscriptions (HTTP 404/410 from the push service) are deleted as they're
 * discovered instead of retried.
 * @param {{ title: string, body: string, url?: string, tag?: string, requireInteraction?: boolean }} payload
 */
export async function sendPushToAll(payload) {
  if (!isPushConfigured()) {
    return { sent: 0, failed: 0, skipped: 'VAPID_NOT_CONFIGURED' };
  }
  ensureConfigured();

  const subscriptions = await prisma.pushSubscription.findMany();
  if (subscriptions.length === 0) return { sent: 0, failed: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;

  await Promise.all(subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body,
      );
      sent += 1;
    } catch (err) {
      failed += 1;
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        console.warn('[push] Gagal mengirim ke', sub.endpoint.slice(0, 60), '-', err?.statusCode, err?.message);
      }
    }
  }));

  return { sent, failed };
}
