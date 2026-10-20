'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Building2, FileQuestion, Flame, Plane, RefreshCw, Route, Search, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { CHART_PALETTE, formatYAxisNumber } from '@/components/ui/ChartTheme';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CustomSelect } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PageHeader from '@/components/ui/PageHeader';
import KpiCard from '@/components/ui/KpiCard';
import SegmentedTabs from '@/components/ui/SegmentedTabs';
import InputDataButton from '@/components/ui/InputDataButton';
import Scope3InputModal from '@/components/scope3/Scope3InputModal';
import { formatNum } from '@/data/sustainabilityData';
import { AIRPORTS } from '@/lib/scope3/airports';

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const TOP_KUU_IN_CHART = 10;
const ALL = 'all';
const EMPTY_FILTERS = { origin: ALL, destination: ALL, kuu: ALL, region: ALL, band: ALL };
const SORTS = {
  emission: { label: 'Emisi terbesar', value: r => r.emissionTon },
  tickets: { label: 'Tiket terbanyak', value: r => r.ticketCount },
  cost: { label: 'Biaya tiket terbesar', value: r => r.flightRupiah },
  distance: { label: 'Jarak terjauh', value: r => r.distanceKm },
};

const KUU_METRICS = {
  emission: {
    label: 'Emisi',
    unit: 'tCO₂e',
    series: [
      { key: 'domesticTon', label: 'Penerbangan domestik', color: CHART_PALETTE.emission },
      { key: 'internationalTon', label: 'Penerbangan internasional', color: CHART_PALETTE.emissionLight },
    ],
    total: row => row.emissionTon,
    format: v => `${formatNum(v, 2)} tCO₂e`,
  },
  cost: {
    label: 'Biaya',
    unit: 'Rp juta',
    series: [
      { key: 'flightJuta', label: 'Tiket pesawat', color: CHART_PALETTE.calc },
      { key: 'otherJuta', label: 'Uang saku, hotel & lainnya', color: CHART_PALETTE.pln },
    ],
    total: row => row.flightJuta + row.otherJuta,
    format: v => `Rp ${formatNum(v, 1)} Jt`,
  },
  distance: {
    label: 'Jarak',
    unit: 'km',
    series: [{ key: 'distanceKm', label: 'Jarak terbang', color: CHART_PALETTE.calc }],
    total: row => row.distanceKm,
    format: v => `${formatNum(v)} km`,
  },
};

const BAND_COLORS = { short: '#E11D48', medium: '#F59E0B', long: '#6366F1', international: '#94A3B8' };

function rupiahShort(value) {
  const juta = (value || 0) / 1_000_000;
  return juta >= 1000
    ? { value: `Rp ${formatNum(juta / 1000, 2)}`, unit: 'Miliar' }
    : { value: `Rp ${formatNum(juta, 1)}`, unit: 'Juta' };
}

const routeLabel = route => route.split('-').join(' → ');
const juta = value => Number(((value || 0) / 1_000_000).toFixed(2));

/** Year, YTD, quarter and month ranges for every year with data plus the current year; future months are left out. */
function periodOptions(availableMonths, now = new Date()) {
  const currentYear = String(now.getFullYear());
  const currentMonth = now.getMonth() + 1;
  const withData = new Set(availableMonths);
  const years = [...new Set([...availableMonths.map(m => m.slice(0, 4)), currentYear])].sort().reverse();
  const ym = (year, month) => `${year}-${String(month).padStart(2, '0')}`;
  const short = month => MONTH_NAMES[month - 1].slice(0, 3);

  const options = years.flatMap(year => {
    const lastMonth = year === currentYear ? currentMonth : 12;
    const hasData = (from, to) => availableMonths.some(m => m >= ym(year, from) && m <= ym(year, to));
    const label = (text, from, to) => (hasData(from, to) ? text : `${text} · belum ada data`);
    const list = [];
    if (year === currentYear && currentMonth < 12) {
      list.push({ value: `${ym(year, 1)}_${ym(year, currentMonth)}`, label: label(`Jan-${short(currentMonth)} ${year} (YTD)`, 1, currentMonth) });
    }
    list.push({ value: `${ym(year, 1)}_${ym(year, 12)}`, label: label(`Setahun ${year}`, 1, 12) });
    for (let q = 4; q >= 1; q -= 1) {
      const from = q * 3 - 2;
      if (from > lastMonth) continue;
      list.push({ value: `${ym(year, from)}_${ym(year, q * 3)}`, label: label(`Kuartal ${q} ${year} (${short(from)}-${short(q * 3)})`, from, q * 3) });
    }
    for (let month = lastMonth; month >= 1; month -= 1) {
      const key = ym(year, month);
      list.push({ value: `${key}_${key}`, label: withData.has(key) ? `${MONTH_NAMES[month - 1]} ${year}` : `${MONTH_NAMES[month - 1]} ${year} · belum ada data` });
    }
    return list;
  });
  // YTD in March equals Q1; keep the first label so every option value stays unique.
  const seen = new Set();
  return options.filter(o => !seen.has(o.value) && seen.add(o.value));
}

function ChartCardHeader({ title, action = null }: { title?: any; action?: any }) {
  return (
    <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
      <CardTitle className="text-base font-bold">{title}</CardTitle>
      {action}
    </CardHeader>
  );
}

export default function Scope3TravelDashboard() {
  const [period, setPeriod] = useState('');
  const [api, setApi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('kuu');
  const [kuuMetric, setKuuMetric] = useState('emission');
  const [search, setSearch] = useState('');
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sortBy, setSortBy] = useState('emission');

  const load = async (selectedPeriod) => {
    setLoading(true);
    setError('');
    try {
      const url = selectedPeriod ? `/api/scope3?period=${encodeURIComponent(selectedPeriod)}` : '/api/scope3';
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setApi(json);
      if (!selectedPeriod && json.period) setPeriod(json.period);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(period || undefined); }, [period]);

  const summary = api?.summary;
  const options = useMemo(() => periodOptions(api?.availableMonths || []), [api?.availableMonths]);
  const hasData = (api?.availableMonths?.length ?? 0) > 0;
  const knownKuu = useMemo(() => (api?.byKuu || []).map(r => r.kuu).sort(), [api?.byKuu]);

  const groups = useMemo(() => api?.flightGroups || [], [api?.flightGroups]);
  const setFilter = key => value => setFilters(prev => ({ ...prev, [key]: value }));
  const activeFilterCount = Object.values(filters).filter(v => v !== ALL).length + (search.trim() ? 1 : 0);
  // Biaya lain belongs to a KUU, not to a route, so it is only shown while no flight filter narrows the rows.
  const flightFilterActive = [filters.origin, filters.destination, filters.region, filters.band].some(v => v !== ALL);

  const filterOptions = useMemo(() => {
    const stopsOf = g => g.route.split('-');
    const airportOption = code => ({ value: code, label: AIRPORTS[code] ? `${code} · ${AIRPORTS[code].name}` : code });
    const origins = [...new Set(groups.map(g => stopsOf(g)[0]))].sort();
    const destinations = [...new Set(groups.flatMap(g => stopsOf(g).slice(1)))].sort();
    return {
      origin: [{ value: ALL, label: 'Semua asal' }, ...origins.map(airportOption)],
      destination: [{ value: ALL, label: 'Semua tujuan' }, ...destinations.map(airportOption)],
      kuu: [{ value: ALL, label: 'Semua KUU' }, ...knownKuu.map(k => ({ value: k, label: k }))],
      region: [{ value: ALL, label: 'Domestik & internasional' }, { value: 'domestic', label: 'Domestik' }, { value: 'international', label: 'Internasional' }],
      band: [{ value: ALL, label: 'Semua jarak' }, ...(api?.distanceBands || []).filter(b => b.id !== 'international').map(b => ({ value: b.id, label: b.label }))],
    };
  }, [groups, knownKuu, api?.distanceBands]);

  const filteredGroups = useMemo(() => groups.filter(g => {
    const stops = g.route.split('-');
    if (filters.origin !== ALL && stops[0] !== filters.origin) return false;
    // A destination matches any later stop, so CGK-DPS-CGK counts as a trip to DPS.
    if (filters.destination !== ALL && !stops.slice(1).includes(filters.destination)) return false;
    if (filters.kuu !== ALL && g.kuu !== filters.kuu) return false;
    if (filters.region === 'domestic' && g.isInternational) return false;
    if (filters.region === 'international' && !g.isInternational) return false;
    if (filters.band !== ALL && g.band !== filters.band) return false;
    return true;
  }), [groups, filters]);

  const rows = useMemo(() => {
    const merged = new Map();
    for (const g of filteredGroups) {
      const key = view === 'kuu' ? g.kuu : g.route;
      if (!merged.has(key)) merged.set(key, { key, isInternational: g.isInternational, ticketCount: 0, distanceKm: 0, emissionTon: 0, flightRupiah: 0 });
      const row = merged.get(key);
      row.ticketCount += g.ticketCount;
      row.distanceKm += g.distanceKm;
      row.emissionTon += g.emissionTon;
      row.flightRupiah += g.flightRupiah;
    }
    if (view === 'kuu' && !flightFilterActive) {
      // KUUs with only allowance or hotel costs have no flight group but still belong in the list.
      for (const k of api?.byKuu || []) {
        if (filters.kuu !== ALL && k.kuu !== filters.kuu) continue;
        if (!merged.has(k.kuu)) merged.set(k.kuu, { key: k.kuu, ticketCount: 0, distanceKm: 0, emissionTon: 0, flightRupiah: 0 });
        Object.assign(merged.get(k.kuu), { otherRupiah: k.otherRupiah, flightRupiah: k.flightRupiah, totalRupiah: k.totalRupiah });
      }
    }
    const query = search.trim().toLowerCase();
    const sortValue = SORTS[sortBy].value;
    return [...merged.values()]
      .filter(r => !query || (view === 'kuu' ? r.key : routeLabel(r.key)).toLowerCase().includes(query))
      .sort((a, b) => sortValue(b) - sortValue(a));
  }, [filteredGroups, view, flightFilterActive, api?.byKuu, filters.kuu, search, sortBy]);

  const showOtherCost = view === 'kuu' && !flightFilterActive;
  const resetFilters = () => { setFilters(EMPTY_FILTERS); setSearch(''); };

  // A month with nothing imported is unknown, not zero: null leaves a gap instead of a misleading drop to 0.
  const monthlyData = useMemo(() => {
    const imported = new Set(api?.availableMonths || []);
    return (api?.monthlyTrend || []).map(m => (imported.has(m.yearMonth)
      ? { ...m, flightJuta: juta(m.flightRupiah), otherJuta: juta(m.otherRupiah) }
      : { yearMonth: m.yearMonth, month: m.month, flightJuta: null, otherJuta: null, emissionTon: null }));
  }, [api?.monthlyTrend, api?.availableMonths]);

  const metric = KUU_METRICS[kuuMetric];
  const kuuChart = useMemo(() => {
    const all = (api?.byKuu || []).map(r => ({ ...r, flightJuta: juta(r.flightRupiah), otherJuta: juta(r.otherRupiah) }))
      .sort((a, b) => metric.total(b) - metric.total(a));
    const grandTotal = all.reduce((s, r) => s + metric.total(r), 0);
    const top = all.slice(0, TOP_KUU_IN_CHART);
    const rest = all.slice(TOP_KUU_IN_CHART);
    if (rest.length) {
      const other: Record<string, any> = { kuu: `${rest.length} KUU lain` };
      metric.series.forEach(s => { other[s.key] = rest.reduce((sum, r) => sum + (r[s.key] || 0), 0); });
      top.push({ ...other, emissionTon: rest.reduce((s, r) => s + r.emissionTon, 0), distanceKm: rest.reduce((s, r) => s + r.distanceKm, 0), flightJuta: other.flightJuta ?? 0, otherJuta: other.otherJuta ?? 0, ticketCount: rest.reduce((s, r) => s + r.ticketCount, 0) });
    }
    return { data: top, grandTotal };
  }, [api?.byKuu, metric]);

  const bands = api?.distanceBands || [];
  const bandTotalTon = bands.reduce((s, b) => s + b.emissionTon, 0);
  const factors = api?.factors || [];
  const totalCost = rupiahShort(summary?.totalRupiah);
  const flightCost = rupiahShort(summary?.flightRupiah);
  const uncounted = rupiahShort((summary?.otherRupiah ?? 0) + (summary?.uncalculatedRupiah ?? 0));
  const routedTickets = Math.max(0, (summary?.ticketCount ?? 0) - (summary?.uncalculatedFlights ?? 0));
  const avgKm = routedTickets ? summary.distanceKm / routedTickets : 0;
  const pending = loading ? '—' : null;

  const kuuChartConfig = Object.fromEntries(metric.series.map(s => [s.key, { label: s.label, color: s.color }]));
  const monthlyConfig = {
    flightJuta: { label: 'Tiket pesawat (Rp juta)', color: CHART_PALETTE.calc },
    otherJuta: { label: 'Biaya lain (Rp juta)', color: CHART_PALETTE.pln },
    emissionTon: { label: 'Emisi (tCO₂e)', color: CHART_PALETTE.emission },
  };

  return (
    <div className="space-y-6 animate-in">
      <PageHeader
        title="Scope 3: Perjalanan Dinas"
        info="Emisi penerbangan dihitung per tiket: rute dipecah per segmen, jaraknya diukur lurus antar bandara, lalu dikalikan faktor emisi per penumpang-km. Uang saku, hotel, dan transport lokal dicatat biayanya saja karena tidak ada data jumlah malam atau jarak."
        actions={
          <>
            {hasData && (
              <div className="w-full sm:w-72">
                <CustomSelect ariaLabel="Periode" value={period} onChange={e => setPeriod(e.target.value)} options={options} />
              </div>
            )}
            <InputDataButton label="Input data Scope 3" icon={Plane} onClick={() => setIsInputOpen(true)} />
          </>
        }
      />

      {error ? (
        <Card className="flex flex-col items-center gap-2 py-10 text-center text-rose-600 dark:text-rose-400">
          <AlertCircle size={20} aria-hidden="true" />
          <p className="text-sm font-semibold">Data Scope 3 belum bisa dimuat: {error}</p>
          <Button variant="danger" size="sm" onClick={() => load(period || undefined)}>Coba lagi</Button>
        </Card>
      ) : !loading && !hasData ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <FileQuestion size={22} className="text-slate-400" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Belum ada data perjalanan dinas.</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
            Tekan &quot;Input data Scope 3&quot; untuk mencatat tiket satu per satu, atau unggah template / ekspor jurnal BPDL. Emisi penerbangan langsung dihitung dari rute.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 relative z-20 has-[[data-popover-open='true']]:z-40">
            <KpiCard label="Emisi penerbangan" value={pending ?? formatNum(summary?.emissionTon ?? 0, 2)} unit="tCO₂e" trend={`Dari ${formatNum(routedTickets)} tiket dengan rute terbaca`} icon={Flame} theme="emission" />
            <KpiCard label="Jarak terbang" value={pending ?? formatNum(summary?.distanceKm ?? 0)} unit="km" trend={`Rata-rata ${formatNum(avgKm)} km per tiket`} icon={Plane} theme="blue" />
            <KpiCard label="Biaya perjalanan dinas" value={pending ?? totalCost.value} unit={totalCost.unit} trend={`Tiket pesawat ${flightCost.value} ${flightCost.unit}`} icon={Wallet} theme="calc" />
            <KpiCard
              label="Biaya belum dihitung emisinya"
              value={pending ?? uncounted.value}
              unit={uncounted.unit}
              trend="Uang saku, hotel, transport lokal, dan tiket tanpa rute"
              icon={Building2}
              theme="default"
              tooltip="Tidak ada data jumlah malam hotel atau jarak transport darat, jadi emisinya tidak dihitung. Lebih baik kosong daripada ditebak dari nominal rupiah."
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <Card className="lg:col-span-3 space-y-4">
              <ChartCardHeader title="Biaya dan emisi per bulan" />
              {loading ? (
                <div role="status" aria-label="Memuat tren bulanan" className="h-72 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              ) : (
                <ChartContainer config={monthlyConfig} className="aspect-auto h-72 w-full">
                  <ComposedChart data={monthlyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis yAxisId="rp" tickLine={false} axisLine={false} width={56} tickFormatter={v => formatYAxisNumber(v)} />
                    <YAxis yAxisId="ton" orientation="right" tickLine={false} axisLine={false} width={44} tickFormatter={v => `${formatYAxisNumber(v)} t`} />
                    <ChartTooltip
                      content={<ChartTooltipContent formatter={(value, name) => (value == null ? 'belum ada data' : name === 'emissionTon' ? `${formatNum(value, 2)} tCO₂e` : `Rp ${formatNum(value, 1)} Jt`)} />}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar yAxisId="rp" dataKey="flightJuta" stackId="cost" fill="var(--color-flightJuta)" maxBarSize={40} isAnimationActive={false} />
                    <Bar yAxisId="rp" dataKey="otherJuta" stackId="cost" fill="var(--color-otherJuta)" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
                    <Line yAxisId="ton" dataKey="emissionTon" stroke="var(--color-emissionTon)" strokeWidth={2.5} dot={{ r: 3.5, fill: 'var(--color-emissionTon)' }} connectNulls={false} isAnimationActive={false} />
                  </ComposedChart>
                </ChartContainer>
              )}
            </Card>

            <Card className="lg:col-span-2 space-y-4">
              <ChartCardHeader title="Emisi menurut jarak penerbangan" />
              {loading ? (
                <div role="status" aria-label="Memuat sebaran jarak" className="h-72 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
              ) : bandTotalTon === 0 ? (
                <p className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">Belum ada tiket dengan rute terbaca di periode ini.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="img" aria-label="Porsi emisi per kelompok jarak">
                    {bands.filter(b => b.emissionTon > 0).map(b => (
                      <span key={b.id} style={{ width: `${(b.emissionTon / bandTotalTon) * 100}%`, backgroundColor: BAND_COLORS[b.id] }} />
                    ))}
                  </div>
                  <ul className="space-y-3">
                    {bands.map(b => (
                      <li key={b.id} className="flex items-start justify-between gap-3 text-xs">
                        <span className="flex items-start gap-2 min-w-0">
                          <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: BAND_COLORS[b.id] }} aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="block font-semibold text-slate-900 dark:text-slate-100">{b.label}</span>
                            <span className="block text-[11px] text-slate-500 dark:text-slate-400">{b.detail} · {formatNum(b.ticketCount)} tiket</span>
                          </span>
                        </span>
                        <span className="text-right shrink-0">
                          <span className="block tabular-nums font-bold text-slate-900 dark:text-slate-100">{formatNum(b.emissionTon, 2)} tCO₂e</span>
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400">{formatNum((b.emissionTon / bandTotalTon) * 100, 1)}%</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </div>

          <Card className="space-y-4">
            <ChartCardHeader
              title={`${metric.label} per KUU`}
              action={
                <SegmentedTabs
                  value={kuuMetric}
                  onChange={setKuuMetric}
                  fullWidthOnMobile={false}
                  options={Object.entries(KUU_METRICS).map(([value, m]) => ({ value, label: m.label }))}
                />
              }
            />
            {loading ? (
              <div role="status" aria-label="Memuat grafik KUU" className="h-80 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            ) : (
              <ChartContainer config={kuuChartConfig} className="aspect-auto w-full" style={{ height: Math.max(260, kuuChart.data.length * 34 + 60) }}>
                <BarChart data={kuuChart.data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={v => formatYAxisNumber(v)} />
                  <YAxis type="category" dataKey="kuu" tickLine={false} axisLine={false} width={84} />
                  <ChartTooltip
                    content={(
                      <ChartTooltipContent
                        labelKey="kuu"
                        labelFormatter={(_, payload) => {
                          const row = payload?.[0]?.payload;
                          if (!row) return null;
                          const share = kuuChart.grandTotal ? (metric.total(row) / kuuChart.grandTotal) * 100 : 0;
                          return `${row.kuu} · ${metric.format(metric.total(row))} (${formatNum(share, 1)}%) · ${formatNum(row.ticketCount)} tiket`;
                        }}
                        formatter={value => metric.format(value)}
                      />
                    )}
                  />
                  {metric.series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
                  {metric.series.map((s, i) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      stackId="kuu"
                      fill={`var(--color-${s.key})`}
                      radius={i === metric.series.length - 1 ? [0, 4, 4, 0] : 0}
                      maxBarSize={20}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ChartContainer>
            )}
          </Card>

          <Card className="space-y-4">
            <ChartCardHeader
              title="Rincian perjalanan dinas"
              action={
                <SegmentedTabs
                  value={view}
                  onChange={setView}
                  fullWidthOnMobile={false}
                  options={[
                    { value: 'kuu', label: 'Per KUU', icon: Building2 },
                    { value: 'route', label: 'Per rute', icon: Route },
                  ]}
                />
              }
            />

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <CustomSelect ariaLabel="Bandara asal" value={filters.origin} onValueChange={setFilter('origin')} options={filterOptions.origin} />
              <CustomSelect ariaLabel="Bandara tujuan" value={filters.destination} onValueChange={setFilter('destination')} options={filterOptions.destination} />
              <CustomSelect ariaLabel="KUU" value={filters.kuu} onValueChange={setFilter('kuu')} options={filterOptions.kuu} />
              <CustomSelect ariaLabel="Domestik atau internasional" value={filters.region} onValueChange={setFilter('region')} options={filterOptions.region} />
              <CustomSelect ariaLabel="Kelompok jarak" value={filters.band} onValueChange={setFilter('band')} options={filterOptions.band} />
              <CustomSelect
                ariaLabel="Urutkan"
                value={sortBy}
                onValueChange={setSortBy}
                options={Object.entries(SORTS).map(([value, option]) => ({ value, label: `Urut: ${option.label}` }))}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-500 dark:text-slate-400 z-10" size={14} aria-hidden="true" />
                <Input
                  aria-label={view === 'kuu' ? 'Cari KUU' : 'Cari rute'}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full sm:w-64 pl-9 pr-3"
                  placeholder={view === 'kuu' ? 'Cari kode KUU' : 'Cari rute, mis. CGK'}
                />
              </label>
              <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                <span>{formatNum(rows.length)} {view === 'kuu' ? 'KUU' : 'rute'} · {formatNum(rows.reduce((sum, r) => sum + r.ticketCount, 0))} tiket</span>
                {activeFilterCount > 0 && (
                  <Button variant="outline" size="sm" onClick={resetFilters}>Hapus filter ({activeFilterCount})</Button>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
              <Table className="min-w-[760px] text-xs" containerClassName="max-h-[560px]">
                <TableHeader className="sticky top-0 z-20 bg-slate-900 dark:bg-slate-950 [&_th]:text-white">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="sticky left-0 z-30 bg-slate-900 dark:bg-slate-950">{view === 'kuu' ? 'KUU' : 'Rute'}</TableHead>
                    <TableHead className="text-right">Tiket</TableHead>
                    {view === 'route' && <TableHead className="text-right">Jarak per tiket</TableHead>}
                    <TableHead className="text-right">{view === 'kuu' ? 'Jarak terbang' : 'Total jarak'}</TableHead>
                    <TableHead className="text-right">Emisi (tCO₂e)</TableHead>
                    <TableHead className="text-right">Biaya tiket</TableHead>
                    {showOtherCost && <TableHead className="text-right">Biaya lain</TableHead>}
                    {showOtherCost && <TableHead className="text-right">Total biaya</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400">
                        <span role="status" className="inline-flex items-center gap-2">
                          <RefreshCw size={16} className="animate-spin text-blue-500" aria-hidden="true" /> Memuat data perjalanan dinas...
                        </span>
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400">
                        {activeFilterCount > 0 ? (
                          <>
                            Tidak ada perjalanan yang cocok dengan filter ini.{' '}
                            <button type="button" onClick={resetFilters} className="rounded font-semibold text-blue-600 dark:text-blue-400 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Hapus filter</button>
                          </>
                        ) : 'Belum ada data untuk periode ini. Pilih periode lain atau input data Scope 3.'}
                      </TableCell>
                    </TableRow>
                  ) : rows.map(row => (
                    <TableRow key={row.key}>
                      <TableHead scope="row" className="sticky left-0 z-10 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {view === 'kuu' ? row.key : routeLabel(row.key)}
                        {view === 'route' && row.isInternational && <span className="ml-2 rounded border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">Internasional</span>}
                      </TableHead>
                      <TableCell className="tabular-nums text-right">{formatNum(row.ticketCount)}</TableCell>
                      {view === 'route' && <TableCell className="tabular-nums text-right">{formatNum(row.ticketCount ? row.distanceKm / row.ticketCount : 0)} km</TableCell>}
                      <TableCell className="tabular-nums text-right">{formatNum(row.distanceKm)} km</TableCell>
                      <TableCell className="tabular-nums text-right font-bold text-amber-700 dark:text-amber-300">{formatNum(row.emissionTon, 2)}</TableCell>
                      <TableCell className="tabular-nums text-right text-slate-600 dark:text-slate-400">Rp {formatNum(row.flightRupiah / 1_000_000, 1)} Jt</TableCell>
                      {showOtherCost && <TableCell className="tabular-nums text-right text-slate-600 dark:text-slate-400">Rp {formatNum((row.otherRupiah ?? 0) / 1_000_000, 1)} Jt</TableCell>}
                      {showOtherCost && <TableCell className="tabular-nums text-right font-semibold">Rp {formatNum((row.totalRupiah ?? row.flightRupiah) / 1_000_000, 1)} Jt</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
                {!loading && rows.length > 0 && (
                  <TableFooter className="sticky bottom-0 z-20">
                    <TableRow className="hover:bg-transparent">
                      <TableHead scope="row" className="sticky left-0 z-30 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100">Total</TableHead>
                      {[
                        formatNum(rows.reduce((sum, r) => sum + r.ticketCount, 0)),
                        ...(view === 'route' ? [''] : []),
                        `${formatNum(rows.reduce((sum, r) => sum + r.distanceKm, 0))} km`,
                        formatNum(rows.reduce((sum, r) => sum + r.emissionTon, 0), 2),
                        `Rp ${formatNum(rows.reduce((sum, r) => sum + r.flightRupiah, 0) / 1_000_000, 1)} Jt`,
                        ...(showOtherCost ? [
                          `Rp ${formatNum(rows.reduce((sum, r) => sum + (r.otherRupiah ?? 0), 0) / 1_000_000, 1)} Jt`,
                          `Rp ${formatNum(rows.reduce((sum, r) => sum + (r.totalRupiah ?? r.flightRupiah), 0) / 1_000_000, 1)} Jt`,
                        ] : []),
                      ].map((cell, i) => (
                        <TableCell key={i} className="bg-slate-100 dark:bg-slate-800 tabular-nums font-bold text-right">{cell}</TableCell>
                      ))}
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </Card>

          <details className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-xs text-slate-600 dark:text-slate-400">
            <summary className="cursor-pointer rounded-lg font-semibold text-slate-800 dark:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              Cara emisi penerbangan dihitung
            </summary>
            <ul className="mt-3 space-y-1.5 pl-5 list-disc leading-relaxed">
              <li>Rute dibaca dari keterangan tiket, misalnya &quot;PKU - CGK - CGK - DPS&quot; menjadi PKU → CGK → DPS. Bandara yang tertulis dua kali berturut-turut dianggap satu titik transit.</li>
              <li>Jarak tiap segmen diukur lurus antar koordinat bandara, tanpa tambahan jarak manuver.</li>
              <li>
                Faktor emisi per penumpang-km:{' '}
                {factors.length ? factors.map(f => `${f.label} ${formatNum(f.value, 3)}`).join('; ') : 'belum termuat'}.
                Tiket dari jurnal dianggap ekonomi karena jurnal tidak mencatat kelas kabin; input manual dan template boleh memilih bisnis.
              </li>
              <li>Segmen yang berangkat atau tiba di luar Indonesia memakai faktor internasional.</li>
              <li>Tiket dengan nominal negatif (refund atau koreksi) mengurangi biaya tetapi tidak mengurangi emisi.</li>
              {factors[0]?.source && <li>Sumber faktor: {factors[0].source}.</li>}
            </ul>
          </details>
        </>
      )}

      {isInputOpen && (
        <Scope3InputModal
          isOpen={isInputOpen}
          onClose={() => setIsInputOpen(false)}
          onSuccess={() => load(period || undefined)}
          knownKuu={knownKuu}
        />
      )}
    </div>
  );
}
