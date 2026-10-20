'use client';

import { formatNum } from '@/data/sustainabilityData';
import KpiCard from '@/components/ui/KpiCard';
import { kwhToMwh } from '@/lib/units';

export default function PLTSLiveStatCards({
  isolarLiveState,
}: { isolarLiveState?: any }) {
  // A.2: Don't show "39 Offline" while loading — distinguish loading/error/data
  const isLoading = !isolarLiveState;
  const isError = isolarLiveState?.success === false;
  const hasData = isolarLiveState?.stationList?.length > 0;

  const isNightOrOff = isolarLiveState?.quota?.isProductionHours === false || (isolarLiveState?.summaryNationwide?.currentRealtimePowerKw === 0 && !isolarLiveState?.quota?.isProductionHours);
  const stationList = isolarLiveState?.stationList || [];

  const offlineList = stationList.filter(s => s.isOffline || s.status === 'Offline' || s.psStatus === 0 || s.ps_status === 0 || (s.subPlants && s.subPlants.length > 0 && s.subPlants.every(sp => sp.isOffline)));
  const faultList = stationList.filter(s => !offlineList.includes(s) && (s.operationalStatus?.key === 'FAULT' || s.hasFault || s.isFault));
  const alarmList = stationList.filter(s => !offlineList.includes(s) && !faultList.includes(s) && (s.operationalStatus?.key === 'ALARM' || s.hasAlarm || s.isAlarm));
  const waitingList = stationList.filter(s => !offlineList.includes(s) && !faultList.includes(s) && !alarmList.includes(s) && (s.isWaiting || s.status?.includes('Menunggu') || s.status?.includes('Pembangunan') || (s.canonicalName || s.name || '').toLowerCase().includes('gorontalo')));
  const onlineList = stationList.filter(s => !offlineList.includes(s) && !faultList.includes(s) && !alarmList.includes(s) && !waitingList.includes(s) && (s.isOnline || (s.currentPowerKw !== null && s.currentPowerKw >= 0)));

  const onlineCount = hasData ? onlineList.length : 0;
  const faultCount = hasData ? faultList.length : 0;
  const alarmCount = hasData ? alarmList.length : 0;
  const waitingCount = hasData ? waitingList.length : 0;
  const offlineCount = hasData ? offlineList.length : 0;
  const monthAcc = isolarLiveState?.monthlyAccumulation;
  const todayCo2Ton = isolarLiveState?.summaryNationwide?.todayCo2OffsetTon || 0;
  const treeCount = Math.round((todayCo2Ton * 1000) / 21.77);

  const statusDetails = [];
  if (onlineCount > 0) statusDetails.push(`${onlineCount} Normal`);
  if (faultCount > 0) statusDetails.push(`${faultCount} Fault`);
  if (alarmCount > 0) statusDetails.push(`${alarmCount} Alarm`);
  if (waitingCount > 0) statusDetails.push(`${waitingCount} Menunggu`);
  if (offlineCount > 0) statusDetails.push(`${offlineCount} Offline`);

  const statusText = isLoading
    ? 'Memuat data...'
    : isError
      ? 'Data gagal dimuat'
      : isNightOrOff
        ? 'Di luar jam produksi matahari (06.00 sampai 18.00 WIB)'
        : statusDetails.join(' • ') || `${onlineCount} Online • ${offlineCount} Offline`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 relative z-20 has-[[data-popover-open='true']]:z-40">
      <KpiCard
        label="Daya saat ini"
        value={isLoading ? '—' : isNightOrOff ? '0' : formatNum(isolarLiveState?.summaryNationwide?.currentRealtimePowerKw || 0, 1)}
        unit={isNightOrOff ? 'kW (malam)' : 'kW'}
        trend={statusText}
        theme="plts"
        tooltip="Total daya yang sedang dihasilkan semua panel surya saat ini."
      />
      <KpiCard
        label="Produksi hari ini"
        value={isLoading ? '—' : formatNum(kwhToMwh(isolarLiveState?.summaryNationwide?.todayGeneratedKwh || 0), 2)}
        unit="MWh"
        trend={isLoading ? 'Memuat...' : isolarLiveState?.isNightBeforeDawn ? 'Angka kemarin, mulai dihitung ulang pukul 06.00 WIB' : `Dari ${isolarLiveState?.stationList?.length ?? '—'} lokasi`}
        theme="plts"
        tooltip="Listrik yang sudah dihasilkan panel surya sejak pagi ini."
      />
      <KpiCard
        label="Produksi bulan ini"
        value={monthAcc?.isAccumulated ? formatNum(monthAcc.monthToDateMwh, 2) : (monthAcc?.displayLabel || '—')}
        unit={monthAcc?.isAccumulated ? 'MWh' : ''}
        trend={monthAcc?.isAccumulated ? monthAcc.displayLabel : 'Belum ada data bulan ini'}
        theme="plts"
        tooltip="Listrik yang dihasilkan panel surya sejak tanggal 1 bulan ini, dihitung dari data harian."
      />
      <KpiCard
        label="Emisi terhindar hari ini"
        value={formatNum(todayCo2Ton, 2)}
        unit="tCO₂e"
        trend={`Setara serapan setahun sekitar ${formatNum(treeCount, 0)} pohon`}
        theme="savings"
        tooltip="Emisi yang tidak jadi keluar karena listrik datang dari panel surya, bukan dari PLN. Angka pohon memakai asumsi satu pohon dewasa menyerap 21,77 kg CO₂ per tahun."
      />
    </div>
  );
}
