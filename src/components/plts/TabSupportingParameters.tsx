'use client';

import { useMemo } from 'react';
import { Bar, BarChart, Cell, Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Sun, Thermometer, CloudRain } from 'lucide-react';
import { usePltsEndpoint } from '@/hooks/usePltsData';
import { TabContentSkeleton } from './PLTSDashboardSkeletons';
import KpiCard from '@/components/ui/KpiCard';
import { CHART_AXIS_PROPS, CHART_GRID_PROPS, CHART_PALETTE, ChartTooltipCard, PARTIAL_OPACITY } from '@/components/ui/ChartTheme';
import { MONTH_LABELS_SHORT } from '@/lib/reportingMonths';

function formatNum(value, min = 0, max = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('id-ID', { minimumFractionDigits: min, maximumFractionDigits: max });
}

const average = (values) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);

const RADIATION_SOURCE_LABEL = {
  ISOLAR_REPORT: 'Sensor iradiasi iSolarCloud',
  OPEN_METEO_CALIBRATED: 'Perkiraan Open-Meteo, disetarakan ke sensor',
};

function EmptyMeasurement({ title, message }: { title?: any; message?: any }) {
  return (
    <div className="h-[200px] rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{title}: belum tersedia</p>
      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-lg">{message}</p>
    </div>
  );
}

/** One small chart per measure, each on its own axis, so no series is squeezed by another's scale. */
function MonthlyMeasureChart({ title, question, rows, dataKey, unit, color, kind, decimals = 1 }: {
  title: string; question: string; rows: any[]; dataKey: string; unit: string; color: string; kind: 'bar' | 'line'; decimals?: number;
}) {
  const hasValues = rows.some((r) => r[dataKey] != null);
  const tooltip = ({ active, payload }: { active?: any; payload?: any }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload;
    const footer = [
      row.partial ? `Bulan berjalan: baru ${row.weatherDays || 0} dari ${row.daysInMonth} hari, angka belum sebulan penuh` : null,
      dataKey === 'radiationKwhM2' && row.radiationSource ? `Sumber: ${RADIATION_SOURCE_LABEL[row.radiationSource] || row.radiationSource}` : null,
    ].filter(Boolean).join('. ');
    return (
      <ChartTooltipCard
        title={`${row.monthLong} ${row.year}`}
        items={[{ label: title, value: `${formatNum(row[dataKey], decimals, decimals)} ${unit}`, dotColor: color }]}
        footer={footer || null}
      />
    );
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 min-w-0">
      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{title} ({unit})</p>
      <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-2">{question}</p>
      {hasValues ? (
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            {kind === 'bar' ? (
              <BarChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid {...CHART_GRID_PROPS} />
                <XAxis dataKey="tick" {...CHART_AXIS_PROPS} interval={0} tick={{ ...CHART_AXIS_PROPS.tick, fontSize: 10 }} />
                <YAxis {...CHART_AXIS_PROPS} width={40} tick={{ ...CHART_AXIS_PROPS.tick, fontSize: 10 }} />
                <Tooltip content={tooltip} cursor={{ fill: 'var(--chart-grid)', opacity: 0.4 }} />
                <Bar isAnimationActive={false} dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={22}>
                  {rows.map((row) => <Cell key={row.yearMonth} fill={color} opacity={row.partial ? PARTIAL_OPACITY : 1} />)}
                </Bar>
              </BarChart>
            ) : (
              <LineChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid {...CHART_GRID_PROPS} />
                <XAxis dataKey="tick" {...CHART_AXIS_PROPS} interval={0} tick={{ ...CHART_AXIS_PROPS.tick, fontSize: 10 }} />
                <YAxis {...CHART_AXIS_PROPS} width={40} domain={['dataMin - 2', 'dataMax + 2']} tickFormatter={(v) => formatNum(v, 0, 0)} tick={{ ...CHART_AXIS_PROPS.tick, fontSize: 10 }} />
                <Tooltip content={tooltip} />
                <Line
                  isAnimationActive={false}
                  type="monotone"
                  dataKey={dataKey}
                  stroke={color}
                  strokeWidth={2}
                  connectNulls
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    if (cx == null || cy == null || payload[dataKey] == null) return <g key={payload.yearMonth} />;
                    // The running month is a hollow dot: same position, visibly not a full month.
                    return payload.partial
                      ? <circle key={payload.yearMonth} cx={cx} cy={cy} r={4} className="fill-white dark:fill-slate-900" stroke={color} strokeWidth={2} />
                      : <circle key={payload.yearMonth} cx={cx} cy={cy} r={4} fill={color} stroke={color} strokeWidth={2} />;
                  }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyMeasurement title={title} message="Belum ada data cuaca untuk periode ini. Data ditarik otomatis setiap hari dari Open-Meteo." />
      )}
    </div>
  );
}

export default function TabSupportingParameters({ filters }: { filters?: any }) {
  const { data, loading, error } = usePltsEndpoint('/api/plts/dashboard/support', filters);

  const rows = useMemo(() => (data?.monthly || []).map((row) => {
    const monthIdx = Number(String(row.yearMonth).slice(-2)) - 1;
    const label = MONTH_LABELS_SHORT[monthIdx] || row.yearMonth;
    return {
      ...row,
      year: String(row.yearMonth).slice(0, 4),
      monthLong: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][monthIdx],
      tick: row.partial ? `${label}*` : label,
      radiationKwhM2: row.radiationKwhM2 != null ? Number(Number(row.radiationKwhM2).toFixed(1)) : null,
      moduleTempC: row.moduleTempC != null ? Number(Number(row.moduleTempC).toFixed(1)) : null,
      precipitationMm: row.precipitationMm != null ? Number(Number(row.precipitationMm).toFixed(1)) : null,
    };
  }), [data]);

  // Card averages use complete months only, so a running month with two days of data does not pull them down.
  const complete = rows.filter((r) => !r.partial);
  const avgOf = (key) => average(complete.map((r) => r[key]).filter((v) => v != null));
  const avgRadiation = avgOf('radiationKwhM2');
  const avgModuleTemp = avgOf('moduleTempC');
  const avgRain = avgOf('precipitationMm');
  const completeRange = complete.length
    ? `${MONTH_LABELS_SHORT[Number(String(complete[0].yearMonth).slice(-2)) - 1]}-${MONTH_LABELS_SHORT[Number(String(complete.at(-1).yearMonth).slice(-2)) - 1]} ${complete.at(-1).year}`
    : null;
  const running = rows.find((r) => r.partial);

  if (loading && !data) return <TabContentSkeleton />;
  if (error && !data) return <EmptyMeasurement title="Data cuaca" message={error} />;

  return (
    <div className="space-y-4" data-testid="tab-supporting-parameters">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          label="Sinar matahari per bulan"
          value={formatNum(avgRadiation, 1, 1)}
          unit="kWh/m²"
          icon={Sun}
          theme="plts"
          tooltip="Energi sinar matahari yang jatuh ke tiap meter persegi panel dalam sebulan (iradiasi). Makin tinggi, makin besar potensi produksi PLTS."
          trend={avgRadiation != null ? `Sekitar ${formatNum(avgRadiation / 30.4, 1, 1)} jam matahari penuh per hari, rata-rata ${completeRange}` : 'Belum ada bulan lengkap'}
        />
        <KpiCard
          label="Suhu panel (perkiraan)"
          value={formatNum(avgModuleTemp, 1, 1)}
          unit="°C"
          icon={Thermometer}
          theme="emission"
          tooltip="Diperkirakan dari suhu udara dan sinar matahari Open-Meteo (model Sandia), bukan diukur sensor. Panel yang lebih panas menghasilkan listrik sedikit lebih rendah."
          trend={avgModuleTemp != null ? `Rata-rata siang hari, ${completeRange}` : 'Belum ada bulan lengkap'}
        />
        <KpiCard
          label="Curah hujan per bulan"
          value={formatNum(avgRain, 0, 1)}
          unit="mm"
          icon={CloudRain}
          theme="water"
          tooltip="Jumlah hujan sebulan dari Open-Meteo, dirata-rata dari semua lokasi DC. Bulan hujan biasanya berawan, sehingga produksi PLTS turun."
          trend={avgRain != null ? `Rata-rata semua lokasi DC, ${completeRange}` : 'Belum ada bulan lengkap'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <MonthlyMeasureChart title="Sinar matahari" question="Berapa banyak sinar matahari tiap bulan?" rows={rows} dataKey="radiationKwhM2" unit="kWh/m²" color={CHART_PALETTE.plts} kind="bar" />
        <MonthlyMeasureChart title="Suhu panel" question="Seberapa panas panel di siang hari?" rows={rows} dataKey="moduleTempC" unit="°C" color={CHART_PALETTE.emission} kind="line" />
        <MonthlyMeasureChart title="Curah hujan" question="Bulan mana yang paling banyak hujan?" rows={rows} dataKey="precipitationMm" unit="mm" color={CHART_PALETTE.water} kind="bar" />
      </div>

      <div className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 space-y-1">
        {running && (
          <p>
            * {running.monthLong} {running.year} masih berjalan: data cuaca baru {running.weatherDays || 0} dari {running.daysInMonth} hari, jadi batangnya dipudarkan dan tidak ikut rata-rata di kartu.
          </p>
        )}
        <p>
          Sumber: sinar matahari dari sensor iradiasi iSolarCloud; bulan yang belum punya laporan lengkap memakai Open-Meteo (CC BY 4.0) yang disetarakan ke sensor. Suhu panel dan curah hujan dari Open-Meteo, ditarik otomatis setiap hari.
        </p>
      </div>

      <details className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs">
        <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded">Lihat angka per bulan</summary>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left tabular-nums">
            <thead className="text-slate-600 dark:text-slate-400">
              <tr>
                <th className="py-1.5 pr-3 font-semibold">Bulan</th>
                <th className="py-1.5 pr-3 font-semibold text-right">Sinar matahari (kWh/m²)</th>
                <th className="py-1.5 pr-3 font-semibold text-right">Suhu panel (°C)</th>
                <th className="py-1.5 pr-3 font-semibold text-right">Curah hujan (mm)</th>
                <th className="py-1.5 font-semibold">Keterangan</th>
              </tr>
            </thead>
            <tbody className="text-slate-800 dark:text-slate-200">
              {rows.map((r) => (
                <tr key={r.yearMonth} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-1.5 pr-3 whitespace-nowrap">{r.monthLong} {r.year}</td>
                  <td className="py-1.5 pr-3 text-right">{formatNum(r.radiationKwhM2, 1, 1)}</td>
                  <td className="py-1.5 pr-3 text-right">{formatNum(r.moduleTempC, 1, 1)}</td>
                  <td className="py-1.5 pr-3 text-right">{formatNum(r.precipitationMm, 1, 1)}</td>
                  <td className="py-1.5 text-slate-600 dark:text-slate-400">
                    {r.partial ? `Berjalan, ${r.weatherDays || 0}/${r.daysInMonth} hari` : (r.radiationSource === 'OPEN_METEO_CALIBRATED' ? 'Sinar matahari: perkiraan Open-Meteo' : '')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
