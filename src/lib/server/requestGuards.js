const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function evaluateCronAuthorization({ configuredSecret, authorization } = {}) {
  if (!configuredSecret) {
    return { allowed: false, status: 503, code: 'CRON_NOT_CONFIGURED' };
  }

  const token = String(authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || token !== configuredSecret) {
    return { allowed: false, status: 401, code: 'UNAUTHORIZED' };
  }

  return { allowed: true, status: 200, code: null };
}

export function evaluateMutationAccess({ nodeEnv, hostname, allowManualSync = false } = {}) {
  if (allowManualSync) {
    return { allowed: true, status: 200, code: null };
  }

  if (nodeEnv === 'production') {
    return { allowed: false, status: 403, code: 'MUTATIONS_DISABLED' };
  }

  const normalizedHost = String(hostname || '').trim().toLowerCase();
  if (!LOOPBACK_HOSTS.has(normalizedHost)) {
    return { allowed: false, status: 403, code: 'LOCAL_ONLY' };
  }

  return { allowed: true, status: 200, code: null };
}

export function mutationDecisionForRequest(request, { allowManualSync } = {}) {
  // A verified login session (see middleware.js + src/lib/auth.js) is now the
  // primary way to open this up: middleware already rejected the request
  // before it got here if there was no valid session cookie, so the
  // x-sparta-user header it forwards can be trusted as "this user logged in".
  // ALLOW_MANUAL_SYNC stays as a manual escape hatch (e.g. for a route that
  // predates/bypasses middleware), but fails closed by default in production.
  const hasAuthenticatedSession = Boolean(request.headers.get('x-sparta-user'));
  const envEscapeHatch = process.env.DISABLE_MUTATIONS !== 'true' && process.env.ALLOW_MANUAL_SYNC === 'true';
  const isAllowed = allowManualSync ?? (hasAuthenticatedSession || envEscapeHatch);
  const decision = evaluateMutationAccess({
    nodeEnv: process.env.NODE_ENV,
    hostname: new URL(request.url).hostname,
    allowManualSync: isAllowed,
  });

  if (!decision.allowed) {
    const message = decision.code === 'MUTATIONS_DISABLED'
      ? 'Mode hanya-baca aktif; operasi ini dinonaktifkan di server ini.'
      : 'Akses mutasi hanya diizinkan melalui localhost.';
    return { ...decision, message };
  }

  return decision;
}
