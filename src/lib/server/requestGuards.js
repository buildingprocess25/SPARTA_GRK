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

export function evaluateMutationAccess({ nodeEnv, hostname } = {}) {
  if (nodeEnv === 'production') {
    return { allowed: false, status: 503, code: 'MUTATIONS_DISABLED' };
  }

  const normalizedHost = String(hostname || '').trim().toLowerCase();
  if (!LOOPBACK_HOSTS.has(normalizedHost)) {
    return { allowed: false, status: 403, code: 'LOCAL_ONLY' };
  }

  return { allowed: true, status: 200, code: null };
}

export function mutationDecisionForRequest(request) {
  return evaluateMutationAccess({
    nodeEnv: process.env.NODE_ENV,
    hostname: new URL(request.url).hostname,
  });
}
