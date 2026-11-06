'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';

import Scope2CompareChart, { useEntityColors } from '@/components/scope2/Scope2CompareChart';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CustomSelect } from '@/components/ui/select';

const number = (value, digits = 0) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value ?? 0);

const MAX_SELECTED = 30;
const DEFAULT_SELECTED = 8;
const METRICS = {
  ton: { label: 'Emisi total', title: 'Emisi per hari', unit: 'tCO₂e', digits: 2, listDigits: 2, field: 'emissionTon' },
  mwh: { label: 'Listrik dari PLN', title: 'Listrik dari PLN per hari', unit: 'MWh', digits: 2, listDigits: 2, field: 'mwh' },
};

async function readJson(url, signal) {
  const response = await fetch(url, { cache: 'no-store', signal });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload.data;
}

export default function Scope2StoreCompare({ data, query, type, headerActions }) {
  const [metric, setMetric] = useState('ton');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [list, setList] = useState({ loading: true, error: '', result: null });
  const [selected, setSelected] = useState(() => new Map());
  const [daily, setDaily] = useState({ loading: false, error: '', series: {} });
  const [highlight, setHighlight] = useState(null);
  const [retry, setRetry] = useState(0);
  const pickDefaults = useRef(true);

  const info = METRICS[metric];

  // A new filter selection starts from its largest stores, because the old picks may not be in it.
  useEffect(() => { pickDefaults.current = true; setPage(0); setSearch(''); }, [query]);
  useEffect(() => { setPage(0); }, [search, metric]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setList(current => ({ ...current, loading: true, error: '' }));
      const params = new URLSearchParams(query);
      params.set('page', String(page));
      params.set('sort', info.field);
      if (search.trim()) params.set('q', search.trim());
      readJson(`/api/scope2/stores/rows?${params}`, controller.signal)
        .then(result => {
          setList({ loading: false, error: '', result });
          if (pickDefaults.current) {
            pickDefaults.current = false;
            setSelected(new Map(result.rows.slice(0, DEFAULT_SELECTED).map(row => [row.code, row])));
          }
        })
        .catch(error => { if (error.name !== 'AbortError') setList({ loading: false, error: error.message, result: null }); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, page, search, info.field, retry]);

  const codes = useMemo(() => [...selected.keys()].sort().join(','), [selected]);
  useEffect(() => {
    if (!codes) { setDaily({ loading: false, error: '', series: {} }); return undefined; }
    const controller = new AbortController();
    setDaily(current => ({ ...current, loading: true, error: '' }));
    const params = new URLSearchParams({ period: data.period, codes });
    if (type) params.set('type', type);
    readJson(`/api/scope2/stores/daily?${params}`, controller.signal)
      .then(result => setDaily({ loading: false, error: '', series: result.series }))
      .catch(error => { if (error.name !== 'AbortError') setDaily({ loading: false, error: error.message, series: {} }); });
    return () => controller.abort();
  }, [codes, data.period, type, retry]);

  const entities = useMemo(() => [...selected.values()].map(row => ({ code: row.code, name: `${row.code} ${row.name}` })), [selected]);
  const { showColors, colorOf } = useEntityColors(entities.map(entity => entity.code));
  const seriesByCode = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const [code, series] of Object.entries<any>(daily.series)) map.set(code, metric === 'ton' ? series.emissionKg.map(kg => kg / 1000) : series.kwh.map(kwh => kwh / 1000));
    return map;
  }, [daily.series, metric]);
  const average = useMemo(() => Array.from({ length: data.daysInMonth }, (_, day) => {
    const lines = entities.map(entity => seriesByCode.get(entity.code)?.[day] ?? 0);
    return lines.length ? lines.reduce((sum, value) => sum + value, 0) / lines.length : 0;
  }), [entities, seriesByCode, data.daysInMonth]);

  const toggle = row => setSelected(current => {
    const next = new Map(current);
    if (next.has(row.code)) next.delete(row.code);
    else if (next.size < MAX_SELECTED) next.set(row.code, row);
    return next;
  });
  const selectPage = () => setSelected(current => {
    const next = new Map(current);
    for (const row of list.result?.rows ?? []) if (next.size < MAX_SELECTED) next.set(row.code, row);
    return next;
  });

  const result = list.result;
  const rankOffset = result ? result.page * 20 : 0;
  const isFull = selected.size >= MAX_SELECTED;
  const monthAverage = entities.length ? [...selected.values()].reduce((sum, row) => sum + row[info.field], 0) / entities.length : 0;
  const chartStatus = daily.error
    ? <span className="inline-flex flex-col items-center gap-2 text-rose-600 dark:text-rose-400"><span>Data harian toko belum bisa dimuat: {daily.error}</span><Button variant="danger" size="sm" onClick={() => setRetry(v => v + 1)}>Coba lagi</Button></span>
    : daily.loading && !seriesByCode.size ? <span role="status" className="inline-flex items-center gap-2"><RefreshCw size={16} className="animate-spin text-blue-500" aria-hidden="true" /> Memuat data harian toko...</span>
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      <Card className="lg:col-span-2 flex min-w-0 flex-col gap-3">
        {headerActions}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Daftar toko ({result ? number(result.total) : '...'})</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">{number(selected.size)} dipilih, maksimal {MAX_SELECTED} toko</p>
          </div>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" onClick={selectPage}>Pilih halaman ini</Button>
            <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" onClick={() => setSelected(new Map())}>Kosongkan</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <CustomSelect ariaLabel="Ukuran peringkat toko" value={metric} onValueChange={setMetric} options={Object.entries(METRICS).map(([value, m]) => ({ value, label: m.label }))} />
          <label className="relative">
            <Search className="absolute left-3 top-2.5 z-10 text-slate-500 dark:text-slate-400" size={14} aria-hidden="true" />
            <Input aria-label="Cari toko di daftar" value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3" placeholder="Cari kode atau nama toko" />
          </label>
        </div>
        <div className="flex max-h-96 min-h-40 flex-col gap-1.5 overflow-y-auto p-0.5 pr-1.5" aria-busy={list.loading}>
          {list.error ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-xs text-rose-600 dark:text-rose-400">
              <span>Daftar toko belum bisa dimuat: {list.error}</span>
              <Button variant="danger" size="sm" onClick={() => setRetry(v => v + 1)}>Coba lagi</Button>
            </div>
          ) : !result ? (
            <p role="status" className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500 dark:text-slate-400"><RefreshCw size={16} className="animate-spin text-blue-500" aria-hidden="true" /> Memuat daftar toko...</p>
          ) : result.rows.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">Tidak ada toko yang cocok dengan pilihan ini.</p>
          ) : result.rows.map((row, index) => {
            const isOn = selected.has(row.code);
            return (
              <label
                key={row.code}
                onMouseEnter={() => setHighlight(row.code)}
                onMouseLeave={() => setHighlight(null)}
                onFocus={() => setHighlight(row.code)}
                onBlur={() => setHighlight(null)}
                className={`grid min-h-[52px] cursor-pointer grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border px-2.5 py-2 hover:border-blue-400 dark:hover:border-blue-500/60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 ${isOn ? 'border-blue-100 bg-blue-50/70 dark:border-blue-500/20 dark:bg-blue-500/10' : 'border-slate-200 dark:border-slate-700'}`}
              >
                <input type="checkbox" checked={isOn} disabled={!isOn && isFull} onChange={() => toggle(row)} className="size-4 accent-blue-600 dark:accent-blue-400" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                    {isOn && showColors && <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorOf(row.code) }} aria-hidden="true" />}
                    <span className="truncate">{row.code} {row.name}</span>
                  </span>
                  <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{row.branchName} · {row.meters} meter · {row.days} hari input</span>
                </span>
                <span className="text-right">
                  <span className="block text-xs font-bold tabular-nums text-slate-900 dark:text-slate-100">{number(row[info.field], info.listDigits)} {info.unit}</span>
                  {!search.trim() && <span className="block text-[11px] text-slate-500 dark:text-slate-400">#{number(rankOffset + index + 1)}</span>}
                </span>
              </label>
            );
          })}
        </div>
        {result?.pages > 1 && (
          <div className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
            <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" disabled={result.page === 0} onClick={() => setPage(result.page - 1)}>Sebelumnya</Button>
            <span>Halaman {number(result.page + 1)} dari {number(result.pages)}</span>
            <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" disabled={result.page >= result.pages - 1} onClick={() => setPage(result.page + 1)}>Berikutnya</Button>
          </div>
        )}
        <p className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
          {entities.length
            ? <>Rata-rata per toko ({number(entities.length)} toko): <strong className="font-bold tabular-nums text-slate-900 dark:text-slate-100">{number(monthAverage, info.listDigits)} {info.unit}</strong></>
            : 'Pilih minimal satu toko.'}
        </p>
      </Card>

      <Scope2CompareChart
        entities={entities}
        seriesByCode={seriesByCode}
        average={average}
        days={data.daysInMonth}
        period={data.period}
        info={info}
        highlight={highlight}
        showColors={showColors}
        colorOf={colorOf}
        noun="toko"
        status={chartStatus}
      />
    </div>
  );
}
