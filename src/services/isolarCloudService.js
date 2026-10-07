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

    if (!res || !res.ok) {
      return {
        success: false,
        error: res ? `Server error (HTTP ${res.status})` : 'Data telemetri live tidak tersedia secara offline.',
        code: 'OFFLINE_OR_UNAVAILABLE',
        stationList: [],
      };
    }

    const data = await res.json().catch(() => null);
    if (!data) {
      return {
        success: false,
        error: 'Respons server tidak valid.',
        code: 'INVALID_JSON',
        stationList: [],
      };
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      success: false,
      error: err.message || 'Koneksi ke endpoint iSolar internal terputus.',
      code: err.name === 'AbortError' ? 'TIMEOUT_ERROR' : 'NETWORK_ERROR',
      stationList: [],
    };
  }
}
