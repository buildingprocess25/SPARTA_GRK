/**
 * Browser-safe client for SPARTA's internal iSolar API.
 * Uses cached database state and fails gracefully if endpoint is unreachable.
 */
export async function fetchLiveIsolarData(forceRefresh = false) {
  try {
    const res = await fetch('/api/isolar', {
      method: forceRefresh ? 'POST' : 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store'
    }).catch(() => null);

    if (!res || !res.ok) {
      return {
        success: false,
        error: 'Data telemetri live tidak tersedia secara offline.',
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
    return {
      success: false,
      error: err.message || 'Koneksi ke endpoint iSolar internal terputus.',
      code: 'NETWORK_ERROR',
      stationList: [],
    };
  }
}
