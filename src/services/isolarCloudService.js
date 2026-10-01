/**
 * Browser-safe client for SPARTA's internal iSolar API.
 * Vendor configuration and credentials belong exclusively to server modules.
 */
export async function fetchLiveIsolarData(forceRefresh = false) {
  try {
    const res = await fetch('/api/isolar', {
      method: forceRefresh ? 'POST' : 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from iSolar Proxy`);
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Gagal mengambil data PLTS dari API internal:', err);
    throw err;
  }
}
