/**
 * Browser-safe client for SPARTA's internal iSolar API.
 * Uses cached database state and fails gracefully if endpoint is unreachable.
 * Includes timeout guard (75s) to prevent indefinite pending states.
 */
export async function fetchLiveIsolarData(forceRefresh = false, { timeoutMs = 75_000 } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('/api/isolar', {
      method: forceRefresh ? 'POST' : 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    }).catch((err) => {
      if (err.name === 'AbortError') {
        throw new Error('Sinkronisasi vendor melebihi batas waktu (timeout 75 detik). Data lama tetap dipertahankan.');
      }
      return null;
    });

    clearTimeout(timeoutId);

    const requestId = `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

    if (!res || !res.ok) {
      let serverJson = null;
      try {
        if (res) serverJson = await res.json().catch(() => null);
      } catch (_) {}

      const statusCode = res?.status || 0;
      const errorCode = serverJson?.code || (statusCode ? `HTTP_${statusCode}` : 'OFFLINE_OR_UNAVAILABLE');
      const rawError = serverJson?.error || (res ? `Server error (HTTP ${res.status})` : 'Data telemetri live tidak tersedia secara offline.');

      return {
        success: false,
        status: statusCode,
        code: errorCode,
        error: rawError,
        requestId,
        stationList: [],
      };
    }

    const data = await res.json().catch(() => null);
    if (!data) {
      return {
        success: false,
        status: res.status,
        error: 'Respons server tidak valid.',
        code: 'INVALID_JSON',
        requestId,
        stationList: [],
      };
    }

    return { ...data, requestId };
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError' || String(err.message || '').includes('timeout');
    return {
      success: false,
      status: 0,
      error: err.message || 'Koneksi ke endpoint iSolar internal terputus.',
      code: isTimeout ? 'TIMEOUT_ERROR' : 'NETWORK_ERROR',
      requestId: `req-err-${Date.now().toString(36)}`,
      stationList: [],
    };
  }
}
