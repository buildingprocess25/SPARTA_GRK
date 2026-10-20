'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Search, RefreshCw, X } from 'lucide-react';
import { notify } from '@/components/ui/ToastProvider';
import { CustomSelect } from '@/components/ui/select';

const SEARCH_DEBOUNCE_MS = 250;

function formatDateTime(value) {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(value));
}

function formatDate(value) {
  if (!value) return null;
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(value));
}

/** Search and pick an active store from the store master synced from the Google Sheet. */
export default function StorePicker({ value, onChange, error }: { value?: any; onChange?: any; error?: any }) {
  const listId = useId();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [branch, setBranch] = useState('');
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [branches, setBranches] = useState([]);
  const [state, setState] = useState('idle'); // 'idle' | 'loading' | 'ready' | 'error'
  const [loadError, setLoadError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [statusError, setStatusError] = useState('');

  const loadStatus = () => fetch('/api/stores/sync', { cache: 'no-store' })
    .then(r => r.json())
    .then(data => {
      if (!data.success) throw new Error(data.error || 'Status sinkronisasi tidak tersedia.');
      setSyncStatus(data);
      setStatusError('');
    })
    .catch(err => setStatusError(err.message));

  useEffect(() => { loadStatus(); }, []);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, limit: '30', ...(branch ? { branch } : {}) });
        const response = await fetch(`/api/stores?${params}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || `Server merespons ${response.status}`);
        if (cancelled) return;
        setResults(data.stores);
        setTotal(data.total);
        setBranches(data.branches);
        setActiveIndex(0);
        setState('ready');
        // Typing a full store code selects it directly.
        if (data.exactMatch && query.trim().toUpperCase() === data.exactMatch && value?.code !== data.exactMatch) {
          onChange(data.stores[0]);
          setIsOpen(false);
        }
      } catch (err) {
        if (cancelled) return;
        setLoadError(err.message);
        setState('error');
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
    // onChange and value are read at response time; re-running the search when they change would refetch needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, branch, reloadKey]);

  const choose = (store) => {
    onChange(store);
    setQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIsOpen(true); setActiveIndex(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && isOpen && results[activeIndex]) { e.preventDefault(); choose(results[activeIndex]); }
    else if (e.key === 'Escape' && isOpen) { e.preventDefault(); e.stopPropagation(); setIsOpen(false); }
  };

  const runSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/stores/sync', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!data.success) throw new Error(data.error || `Server merespons ${response.status}`);
      setSyncStatus(data);
      notify.success('Data toko diperbarui', `${data.run.rowCount} toko dibaca dari Google Sheet.`);
      setReloadKey(key => key + 1);
    } catch (err) {
      notify.error('Sinkronisasi toko gagal', err.message);
      loadStatus();
    } finally {
      setIsSyncing(false);
    }
  };

  const hasNoStores = state === 'ready' && total === 0 && !query && !branch;
  const lastSuccess = syncStatus?.lastSuccess;
  const lastRun = syncStatus?.lastRun;

  return (
    <div className="space-y-2">
      {value ? (
        <div className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${error ? 'border-rose-400 dark:border-rose-500/60' : 'border-slate-200 dark:border-slate-700'} bg-white dark:bg-slate-900`}>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{value.name}</p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              Kode <span className="font-semibold text-slate-800 dark:text-slate-200">{value.code}</span>{value.branch ? ` · Branch ${value.branch}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { onChange(null); setTimeout(() => inputRef.current?.focus(), 0); }}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 min-h-9 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <X size={13} aria-hidden="true" /> Ganti toko
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="relative sm:col-span-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
              <input
                ref={inputRef}
                type="search"
                role="combobox"
                aria-expanded={isOpen}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={isOpen && results[activeIndex] ? `${listId}-${results[activeIndex].code}` : undefined}
                aria-label="Cari toko berdasarkan kode atau nama"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
                onFocus={() => setIsOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder="Kode atau nama toko, contoh 1A07"
                className={`w-full rounded-xl border bg-white dark:bg-slate-900 pl-8 pr-3 py-2 min-h-10 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 ${error ? 'border-rose-400 dark:border-rose-500/60' : 'border-slate-200 dark:border-slate-700'}`}
              />
            </div>
            <div className="w-48 shrink-0">
              <CustomSelect
                ariaLabel="Filter branch"
                value={branch}
                onChange={(e) => {
                  setBranch(e.target.value);
                  setIsOpen(true);
                }}
                options={[
                  { value: '', label: 'Semua branch' },
                  ...branches.map(item => ({
                    value: item.branch,
                    label: `${item.branch} (${item.count})`,
                  })),
                ]}
              />
            </div>
          </div>

          {isOpen && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
              {state === 'loading' && <p className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400" role="status">Mencari toko...</p>}
              {state === 'error' && (
                <p className="px-3 py-3 text-xs text-rose-700 dark:text-rose-300" role="alert">Daftar toko gagal dimuat. {loadError.replace(/\.?$/, '.')}</p>
              )}
              {hasNoStores && (
                <p className="px-3 py-3 text-xs text-slate-600 dark:text-slate-400">
                  Data toko belum ada. Jalankan sinkronisasi dari Google Sheet di bawah untuk mengisinya.
                </p>
              )}
              {state === 'ready' && !hasNoStores && results.length === 0 && (
                <p className="px-3 py-3 text-xs text-slate-600 dark:text-slate-400">
                  Tidak ada toko aktif yang cocok{query ? ` dengan "${query}"` : ''}{branch ? ` di branch ${branch}` : ''}.
                </p>
              )}
              {state === 'ready' && results.length > 0 && (
                <>
                  <ul id={listId} role="listbox" aria-label="Hasil pencarian toko" className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {results.map((store, index) => (
                      <li
                        key={store.code}
                        id={`${listId}-${store.code}`}
                        role="option"
                        aria-selected={index === activeIndex}
                        onMouseDown={(e) => { e.preventDefault(); choose(store); }}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={`flex items-center gap-3 px-3 py-2.5 min-h-11 cursor-pointer ${index === activeIndex ? 'bg-rose-50 dark:bg-rose-500/10' : ''}`}
                      >
                        <span className="w-12 shrink-0 text-xs font-bold text-slate-900 dark:text-slate-100">{store.code}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{store.name}</span>
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400">{store.branch}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {total > results.length && (
                    <p className="px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                      Menampilkan {results.length} dari {total} toko. Ketik kode atau nama untuk mempersempit.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {error && <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <span>
          {statusError
            ? <span className="text-rose-700 dark:text-rose-300">{statusError}</span>
            : lastSuccess
              ? `${syncStatus.counts.activeSelectable.toLocaleString('id-ID')} toko aktif · disinkron ${formatDate(lastSuccess.startedAt)} dari Google Sheet`
              : 'Belum pernah disinkron dari Google Sheet.'}
          {lastRun?.status === 'FAILED' && (
            <span className="block text-rose-700 dark:text-rose-300">Sinkron terakhir ({formatDateTime(lastRun.startedAt)}) gagal: {lastRun.errorMessage}</span>
          )}
        </span>
        <button
          type="button"
          onClick={runSync}
          disabled={isSyncing}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 min-h-9 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} aria-hidden="true" />
          {isSyncing ? 'Menyinkronkan...' : 'Sinkronkan sekarang'}
        </button>
      </div>
    </div>
  );
}
