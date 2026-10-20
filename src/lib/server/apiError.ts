import { NextResponse } from 'next/server';

/**
 * Checks whether an error is a database connection or pool exhaustion error
 */
export function isDbConnectionError(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '');
  return (
    code === 'P2024' || // Timed out fetching a new connection from the connection pool
    code === 'P1001' || // Can't reach database server
    code === 'P1002' || // The database server was reached but timed out
    code === 'P1017' || // Server has closed the connection
    code === 'P2028' || // Transaction API error
    /connection pool|timed out fetching a new connection|pool timeout|database.*unavailable|ETIMEDOUT|ECONNREFUSED|ECONNRESET/i.test(msg)
  );
}

/**
 * Strips credentials, database connection strings, and tokens from error messages
 */
export function sanitizeErrorMessage(msg) {
  if (!msg || typeof msg !== 'string') return '';
  return msg
    .replace(/(postgres|mysql|mongodb):\/\/[^@]+@/gi, '$1://[REDACTED]@')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/password=[^&;\s]+/gi, 'password=[REDACTED]')
    .replace(/token=[^&;\s]+/gi, 'token=[REDACTED]');
}

/**
 * Unified, secret-safe API error handler for Next.js route handlers
 */
export function handleApiError({
  endpoint,
  startTime,
  error,
  defaultCode = 'INTERNAL_ERROR',
  defaultMessage = 'Terjadi kesalahan saat memproses permintaan data.',
  validationRegex = /mode|month|throughMonth|required|invalid/i,
}) {
  const durationMs = startTime ? Date.now() - startTime : 0;
  const rawMsg = error?.message || '';
  const sanitizedMsg = sanitizeErrorMessage(rawMsg);
  const isConnErr = isDbConnectionError(error);
  const isValidation = validationRegex ? validationRegex.test(rawMsg) : false;

  let status = 500;
  let code = defaultCode;
  let clientMessage = defaultMessage;

  if (isValidation) {
    status = 400;
    code = 'INVALID_QUERY';
    clientMessage = sanitizedMsg || defaultMessage;
  } else if (isConnErr) {
    status = 503;
    code = 'DATABASE_UNAVAILABLE';
    clientMessage = 'Layanan database sementara sibuk atau mengalami timeout antrian. Data tersimpan tetap aman, silakan coba beberapa saat lagi.';
  }

  // Structured, secret-safe log line
  console.error(
    `[API_ERROR] endpoint=${endpoint} duration=${durationMs}ms code=${code} status=${status} error=${sanitizedMsg}`
  );

  return NextResponse.json({
    success: false,
    status: 'error',
    endpoint,
    code,
    error: clientMessage,
  }, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
