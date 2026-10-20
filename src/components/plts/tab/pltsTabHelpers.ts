import { PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH } from '@/lib/solar/conversionConfig';

export const PLTS_EMISSION_FACTOR_LABEL = String(PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH).replace('.', ',');

export function classifySyncError({ error, status, code, lastSyncTime }: { error?: any; status?: any; code?: any; lastSyncTime?: any }) {
  const errStr = String(error || '').toLowerCase();
  const codeStr = String(code || '').toUpperCase();
  const statusNum = Number(status) || 0;
  const timeLabel = lastSyncTime ? `(${lastSyncTime})` : '';

  // Token / otentikasi
  if (statusNum === 401 || errStr.includes('token') || errStr.includes('unauthorized') || codeStr.includes('AUTH') || codeStr.includes('TOKEN')) {
    return {
      category: 'AUTH',
      badge: 'Izin akses',
      message: `Aplikasi tidak bisa masuk ke iSolarCloud. Yang tampil adalah data terakhir (${timeLabel}). Sistem mencoba lagi otomatis.`,
      advice: 'Izin akses ke iSolarCloud habis masa berlakunya atau ditolak. Sistem memperbaruinya sendiri.',
    };
  }

  // Kuota habis
  if (statusNum === 429 || errStr.includes('kuota') || errStr.includes('quota') || errStr.includes('hard limit') || codeStr.includes('QUOTA')) {
    return {
      category: 'QUOTA',
      badge: 'Batas permintaan',
      message: `Batas permintaan data ke iSolarCloud sudah tercapai. Yang tampil adalah data terakhir (${timeLabel}). Sistem mencoba lagi otomatis.`,
      advice: 'Batasnya 2.000 permintaan per jam dan 100.000 per bulan. Pengambilan data lanjut lagi di jam berikutnya.',
    };
  }

  // Jaringan / timeout
  if (statusNum === 408 || errStr.includes('timeout') || errStr.includes('network') || errStr.includes('terputus') || codeStr.includes('TIMEOUT') || codeStr.includes('NETWORK')) {
    return {
      category: 'NETWORK',
      badge: 'Koneksi',
      message: `Koneksi ke iSolarCloud terputus. Yang tampil adalah data terakhir (${timeLabel}). Sistem mencoba lagi otomatis.`,
      advice: 'Koneksi ke server iSolarCloud sedang lambat. Sistem mencoba lagi dalam 10 menit.',
    };
  }

  // Database sibuk / pool timeout
  if (codeStr.includes('DATABASE') || codeStr.includes('POOL') || errStr.includes('database') || errStr.includes('antrian')) {
    return {
      category: 'DATABASE',
      badge: 'Database sibuk',
      message: `Database sedang sibuk. Yang tampil adalah data tersimpan terakhir (${timeLabel}). Sistem mencoba lagi otomatis.`,
      advice: 'Data yang sudah tersimpan tetap aman. Sistem memuat ulang secara bertahap.',
    };
  }

  // Mode hanya-baca (MUTATIONS_DISABLED)
  if (statusNum === 403 || codeStr === 'MUTATIONS_DISABLED' || errStr.includes('hanya-baca') || errStr.includes('read-only')) {
    return {
      category: 'READ_ONLY',
      badge: 'Hanya baca',
      message: `Server ini hanya bisa membaca data. Yang tampil adalah data terakhir (${timeLabel}). Data tetap diperbarui otomatis.`,
      advice: 'Tombol perbarui manual dimatikan di server ini. Data tetap diperbarui otomatis setiap 10 menit.',
    };
  }

  // Server iSolar down (502/503/504)
  if (statusNum === 503 || statusNum === 502 || statusNum === 504 || errStr.includes('503') || errStr.includes('502') || codeStr.includes('GATEWAY') || codeStr.includes('SERVER')) {
    return {
      category: 'SERVER',
      badge: 'Server iSolarCloud',
      message: `Server iSolarCloud tidak merespons. Yang tampil adalah data terakhir (${timeLabel}). Sistem mencoba lagi otomatis.`,
      advice: 'Server iSolarCloud sedang sibuk atau dalam perbaikan. Data terakhir tetap ditampilkan.',
    };
  }

  return {
    category: 'GENERAL',
    badge: 'Koneksi',
    message: `Data dari iSolarCloud gagal diambil. Yang tampil adalah data terakhir (${timeLabel}). Sistem mencoba lagi otomatis.`,
    advice: 'iSolarCloud sedang tidak merespons dengan normal. Data terakhir tetap tersimpan.',
  };
}
