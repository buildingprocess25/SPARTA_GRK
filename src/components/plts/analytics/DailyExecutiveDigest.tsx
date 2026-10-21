'use client';

import { useState, useMemo } from 'react';
import { Copy, Check, Download, Clock } from 'lucide-react';
import { formatNum } from '@/data/sustainabilityData';
import InfoHint from '@/components/ui/InfoHint';

interface DailyExecutiveDigestProps {
  items: any[];
  lastSyncTime?: string;
  onNavigateToTelemetry?: () => void;
}

export default function DailyExecutiveDigest({
  items = [],
  lastSyncTime = 'Baru saja',
  onNavigateToTelemetry,
}: DailyExecutiveDigestProps) {
  const [copied, setCopied] = useState(false);

  // Waktu terkini dalam zona WIB
  const digestTime = useMemo(() => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const currentHourWib = parseInt(formatter.format(now).split(':')[0] || '12', 10);
    const dateFormatted = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now);

    const isCutoffPassed = currentHourWib >= 18;

    return {
      timeString: formatter.format(now) + ' WIB',
      dateFormatted,
      isCutoffPassed,
      currentHourWib,
    };
  }, []);

  // Filter 36 DC operasional aktif (37 DC total: 36 operasional, 1 Gorontalo tahap konstruksi, Toko Drive Thru dikecualikan)
  const operationalItems = useMemo(() => {
    return items.filter(d => {
      const name = (d.canonicalName || d.name || '').toLowerCase();
      const isDriveThru = name.includes('drive thru') || name.includes('toko') || d.facilityType === 'STORE';
      const isGorontalo = d.dcId === 'DC-GORONTALO' || name.includes('gorontalo');
      return !d.isUnderConstruction && !isGorontalo && !isDriveThru;
    });
  }, [items]);

  // Agregasi metrik harian
  const digestMetrics = useMemo(() => {
    const totalTodayKwh = operationalItems.reduce((acc, curr) => {
      const val = curr.todayYieldKwh ? Number(curr.todayYieldKwh) : (curr.productionKwh || 0);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);

    const totalTodayMwh = Number((totalTodayKwh / 1000).toFixed(2));
    const totalInstalledKwp = operationalItems.reduce((acc, curr) => acc + (Number(curr.installedKwp) || 0), 0);
    const nationalSpecificYield = totalInstalledKwp > 0 ? Number((totalTodayKwh / totalInstalledKwp).toFixed(2)) : 0;

    // Emisi terhindar (faktor 0.997 kg CO2e / kWh)
    const avoidedCo2Ton = Number(((totalTodayKwh * 0.997) / 1000).toFixed(2));
    const treeEquivalent = Math.round((avoidedCo2Ton * 1000) / 21.77);

    // 3 DC dengan Specific Yield tertinggi hari ini
    const validYieldItems = operationalItems
      .filter(d => d.todaySpecificYield !== null && d.todaySpecificYield !== undefined && !isNaN(d.todaySpecificYield) && d.todaySpecificYield > 0)
      .sort((a, b) => (b.todaySpecificYield || 0) - (a.todaySpecificYield || 0));

    const topPerformers = validYieldItems.slice(0, 3);

    // DC yang memerlukan perhatian teknis atau pemeliharaan
    const attentionList = operationalItems.filter(d => {
      const isOffline = d.isOffline || d.status === 'Offline' || d.psStatus === 0;
      const isAlarm = d.hasAlarm || d.status === 'Alarm' || d.isFault;
      const isHighTemp = d.inverterTempMax && Number(d.inverterTempMax) >= 65;
      const isVeryLowYield = digestTime.currentHourWib >= 14 && d.todaySpecificYield !== null && d.todaySpecificYield < 1.0 && !isOffline;

      return isOffline || isAlarm || isHighTemp || isVeryLowYield;
    }).map(d => {
      let statusLabel = 'Perlu dicek';
      let statusType = 'warning';
      let detail = 'Perlu inspeksi teknisi';

      if (d.isOffline || d.status === 'Offline') {
        statusLabel = 'Offline';
        statusType = 'danger';
        detail = 'Komunikasi inverter terputus';
      } else if (d.hasAlarm || d.isFault) {
        statusLabel = 'Alarm';
        statusType = 'danger';
        detail = 'Sinyal proteksi inverter aktif';
      } else if (d.inverterTempMax && Number(d.inverterTempMax) >= 65) {
        statusLabel = 'Suhu tinggi';
        statusType = 'warning';
        detail = `Suhu inverter mencapai ${d.inverterTempMax}°C`;
      } else if (d.todaySpecificYield !== null && d.todaySpecificYield < 1.0) {
        statusLabel = 'Yield rendah';
        statusType = 'warning';
        detail = `Specific yield ${d.todaySpecificYield} kWh/kWp`;
      }

      return {
        ...d,
        statusLabel,
        statusType,
        detail,
      };
    });

    return {
      totalTodayKwh,
      totalTodayMwh,
      totalInstalledKwp: Number(totalInstalledKwp.toFixed(1)),
      nationalSpecificYield,
      avoidedCo2Ton,
      treeEquivalent,
      topPerformers,
      attentionList,
      operationalCount: operationalItems.length,
    };
  }, [operationalItems, digestTime]);

  // Format pesan teks bersih untuk ekspor / memo manajemen (tanpa emoji berlebihan)
  const plainSummaryText = useMemo(() => {
    const statusHeader = digestTime.isCutoffPassed 
      ? 'LAPORAN REKAP FINAL HARIAN PLTS (18:00 WIB)'
      : `RINGKASAN OPERASIONAL PLTS (${digestTime.timeString})`;

    let text = `${statusHeader}\n`;
    text += `Tanggal: ${digestTime.dateFormatted}\n`;
    text += `Sinkronisasi iSolarCloud: ${lastSyncTime}\n\n`;

    text += `1. RINGKASAN PRODUKSI NASIONAL\n`;
    text += `- Total Produksi: ${formatNum(digestMetrics.totalTodayMwh, 2)} MWh (${formatNum(digestMetrics.totalTodayKwh, 0)} kWh)\n`;
    text += `- Rerata Specific Yield: ${digestMetrics.nationalSpecificYield} kWh/kWp\n`;
    text += `- Emisi CO2 Terhindar: ${formatNum(digestMetrics.avoidedCo2Ton, 2)} ton CO2e\n`;
    text += `- Ekuivalen Serapan: ~${formatNum(digestMetrics.treeEquivalent, 0)} pohon\n`;
    text += `- DC Beroperasi: ${digestMetrics.operationalCount} dari 37 DC (1 DC Gorontalo tahap konstruksi)\n\n`;

    text += `2. PERINGKAT DC DENGAN YIELD TERTINGGI\n`;
    digestMetrics.topPerformers.forEach((p, idx) => {
      text += `${idx + 1}. ${p.canonicalName}: ${p.todaySpecificYield} kWh/kWp (${formatNum(p.todayYieldKwh || 0, 0)} kWh | ${p.installedKwp} kWp)\n`;
    });

    text += `\n3. STATUS OPERASIONAL & ATENSI TEKNIS\n`;
    if (digestMetrics.attentionList.length === 0) {
      text += `- Seluruh 36 DC beroperasi normal tanpa alarm aktif.\n`;
    } else {
      digestMetrics.attentionList.forEach(a => {
        text += `- ${a.canonicalName}: ${a.statusLabel} (${a.detail})\n`;
      });
      text += `\nRekomendasi: Jadwalkan verifikasi komunikasi dan pembersihan modul surya.`;
    }

    text += `\n\nSistem Pemantauan SPARTA-GRK`;
    return text;
  }, [digestTime, digestMetrics, lastSyncTime]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plainSummaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([plainSummaryText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Laporan-Ringkasan-Harian-PLTS-${digestTime.dateFormatted.replace(/\s+/g, '-')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div 
      className="mt-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
      data-testid="daily-executive-digest"
    >
      {/* Bar Header Enterprise */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            Ringkasan Operasional Harian PLTS
          </h3>
          <InfoHint
            title="Ringkasan Operasional PLTS"
            text="Rekapitulasi cut-off harian pukul 18:00 WIB dari 36 DC aktif beroperasi (1 DC Gorontalo dalam tahap konstruksi). Menampilkan total energi bersih, emisi terhindar, peringkat specific yield, dan daftar DC yang memerlukan tindakan pemeliharaan."
          />
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 ml-1">
            ({digestTime.isCutoffPassed ? 'Cut-off 18:00 WIB' : `Status s.d. ${digestTime.timeString}`})
          </span>
        </div>

        {/* Tombol Aksi Bersih & Fungsional */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition ${
              copied
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60'
            }`}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? 'Tersalin' : 'Salin Ringkasan'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadTxt}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition"
          >
            <Download size={13} />
            <span>Unduh Laporan (.txt)</span>
          </button>
        </div>
      </div>

      {/* 4 Kolom Metrik Ringkasan Utama (Tanpa Emote / Toy Icons) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/40">
        <div className="p-4">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
            Produksi Listrik Hari Ini
          </span>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
              {formatNum(digestMetrics.totalTodayMwh, 2)}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">MWh</span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
            {formatNum(digestMetrics.totalTodayKwh, 0)} kWh energi tersalurkan
          </span>
        </div>

        <div className="p-4">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
            Rerata Specific Yield
          </span>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
              {digestMetrics.nationalSpecificYield}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">kWh/kWp</span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
            Dari total {digestMetrics.totalInstalledKwp} kWp terpasang
          </span>
        </div>

        <div className="p-4">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
            Emisi Gas Rumah Kaca Terhindar
          </span>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
              {formatNum(digestMetrics.avoidedCo2Ton, 2)}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">ton CO₂e</span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
            Faktor emisi 0,997 kg CO₂e/kWh
          </span>
        </div>

        <div className="p-4">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
            Ekuivalensi Serapan Pohon
          </span>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
              ~{formatNum(digestMetrics.treeEquivalent, 0)}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">pohon</span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
            Setara daya serap pohon tahunan
          </span>
        </div>
      </div>

      {/* Tabel Dua Kolom Bersih: Peringkat Produksi & Status Atensi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800">
        {/* Kolom Kiri: Tabel Peringkat Yield Tertinggi */}
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
              Peringkat Specific Yield Tertinggi
            </h4>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              3 Performa Terbaik Hari Ini
            </span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="py-2 px-3 font-semibold w-10 text-center">No</th>
                  <th className="py-2 px-3 font-semibold">Nama Distribusi Center (DC)</th>
                  <th className="py-2 px-3 font-semibold text-right">Kapasitas</th>
                  <th className="py-2 px-3 font-semibold text-right">Produksi</th>
                  <th className="py-2 px-3 font-semibold text-right">Yield</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {digestMetrics.topPerformers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-400 dark:text-slate-500 text-xs">
                      Belum ada data yield tercatat hari ini
                    </td>
                  </tr>
                ) : (
                  digestMetrics.topPerformers.map((p, idx) => (
                    <tr key={p.dcId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-500 dark:text-slate-400 text-center">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">
                        {p.canonicalName}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400 text-right">
                        {p.installedKwp} kWp
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400 text-right">
                        {formatNum(p.todayYieldKwh || 0, 0)} kWh
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100 text-right">
                        {p.todaySpecificYield} <span className="font-normal text-[10px] text-slate-500">kWh/kWp</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Kolom Kanan: Status Pemeliharaan & Atensi Teknis */}
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
              Status Pemeliharaan & Atensi Teknis
            </h4>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {digestMetrics.attentionList.length === 0 ? 'Semua DC Normal' : `${digestMetrics.attentionList.length} DC Memerlukan Pengecekan`}
            </span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="py-2 px-3 font-semibold">Nama DC</th>
                  <th className="py-2 px-3 font-semibold">Indikasi Masalah / Telemetri</th>
                  <th className="py-2 px-3 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {digestMetrics.attentionList.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 px-3 text-center text-slate-500 dark:text-slate-400 text-xs">
                      Seluruh 36 DC aktif beroperasi normal tanpa alarm proteksi atau anomali transmisi.
                    </td>
                  </tr>
                ) : (
                  digestMetrics.attentionList.map(a => (
                    <tr key={a.dcId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">
                        {a.canonicalName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        {a.detail}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`inline-block font-mono text-[11px] font-medium px-2 py-0.5 rounded ${
                          a.statusType === 'danger'
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                        }`}>
                          {a.statusLabel}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
