'use client';

export function SafePrBarTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white rounded-xl p-3 shadow-xl border border-slate-800 text-xs space-y-1.5 min-w-[220px]">
        <p className="font-bold text-slate-100 border-b border-slate-700 pb-1">{data.name}</p>
        <div className="flex justify-between items-center text-slate-300">
          <span>Perkiraan PR (audit):</span>
          <strong className="text-emerald-400 tabular-nums text-sm">
            {data.pr !== null && data.pr !== undefined ? `${data.pr}%` : '—'}
          </strong>
        </div>
        {data.rawPr > 100 && (
          <p className="text-[10px] text-amber-300">
            * Iradiasi lokal April &gt; 4.2 PSH (nilai mentah {data.rawPr}%)
          </p>
        )}
        <div className="flex justify-between items-center text-slate-400 text-[11px]">
          <span>Kapasitas:</span>
          <span className="tabular-nums">{data.installedKwp} kWp</span>
        </div>
        <div className="flex justify-between items-center text-slate-400 text-[11px]">
          <span>Produksi (audit):</span>
          <span className="tabular-nums">{data.monthYieldMwh} MWh</span>
        </div>
        <p className="text-[9px] text-slate-400 pt-1 border-t border-slate-800">
          Sumber: audit April 2026, bukan data langsung
        </p>
      </div>
    );
  }
  return null;
}

// backdrop-blur-md on this tooltip's near-opaque background keeps its text
// legible when it floats directly over busy chart gridlines/bars.
export function SafeTrendTooltip({ active, payload, label, activeMetricUnit, unitMode, chartViewMode, hoveredDCId }) {
  if (active && payload && payload.length) {
    const rawData = payload[0]?.payload || {};
    const unit = activeMetricUnit || '';
    const unitSuffix = unitMode === 'daily' ? `${unit}/hari` : unit;

    const avgVal = rawData.average;
    const minVal = rawData.min;
    const maxVal = rawData.max;

    if (chartViewMode === 'average') {
      return (
        <div className="bg-slate-900/95 text-white rounded-xl p-3.5 shadow-2xl border border-slate-700/80 text-xs space-y-2 min-w-[210px] backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-1.5">
            <span className="font-bold text-slate-100 text-sm">{label}</span>
            <span className="text-[10px] text-blue-300 font-semibold px-2 py-0.5 rounded bg-blue-900/50">Rata-rata</span>
          </div>
          <div className="bg-blue-950/60 border border-blue-800/60 rounded-lg p-2 space-y-1">
            <div className="flex justify-between items-center text-slate-200">
              <span className="text-xs text-blue-300">Rata-rata (menurut kapasitas):</span>
              <strong className="text-blue-100 tabular-nums text-sm">{avgVal !== null && avgVal !== undefined ? avgVal : '—'} {unitSuffix}</strong>
            </div>
            <p className="text-[10px] text-blue-300">Total produksi ÷ total kapasitas</p>
          </div>
        </div>
      );
    }

    if (chartViewMode === 'minmax') {
      const rangeDiff = (minVal !== null && maxVal !== null && !isNaN(minVal) && !isNaN(maxVal))
        ? Number((maxVal - minVal).toFixed(2))
        : null;

      return (
        <div className="bg-slate-900/95 text-white rounded-xl p-3.5 shadow-2xl border border-slate-700/80 text-xs space-y-2 min-w-[230px] backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-1.5">
            <span className="font-bold text-slate-100 text-sm">{label}</span>
            <span className="text-[10px] text-amber-300 font-semibold px-2 py-0.5 rounded bg-amber-900/50">Terendah sampai tertinggi</span>
          </div>
          <div className="space-y-1 bg-slate-800/60 rounded-lg p-2 border border-slate-700/50">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Maksimum:</span>
              <strong className="text-emerald-400 tabular-nums">{maxVal !== null && maxVal !== undefined ? maxVal : '—'} {unitSuffix}</strong>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Minimum:</span>
              <strong className="text-rose-400 tabular-nums">{minVal !== null && minVal !== undefined ? minVal : '—'} {unitSuffix}</strong>
            </div>
            {rangeDiff !== null && (
              <div className="flex justify-between items-center text-[10px] text-slate-300 pt-1 border-t border-slate-700/60">
                <span className="text-slate-300">Selisih:</span>
                <span className="tabular-nums text-slate-200 font-semibold">{rangeDiff} {unitSuffix}</span>
              </div>
            )}
          </div>
          {avgVal !== null && avgVal !== undefined && (
            <div className="flex justify-between items-center text-[11px] text-blue-300 px-1 pt-0.5">
              <span>Rata-rata:</span>
              <strong className="tabular-nums">{avgVal} {unitSuffix}</strong>
            </div>
          )}
        </div>
      );
    }

    // Mode "individual" (Semua PLTS)
    const plantEntries = payload
      .filter(p => p && p.dataKey && p.dataKey !== 'average' && p.dataKey !== 'min' && p.dataKey !== 'max' && p.dataKey !== 'targetPr' && !p.dataKey.endsWith('_yieldMwh'))
      .map(p => ({
        name: p.name,
        value: p.value,
        color: p.color || p.stroke || '#38BDF8',
        dcId: p.dataKey
      }))
      .filter(p => p.value !== null && p.value !== undefined && !isNaN(p.value))
      .sort((a, b) => {
        if (hoveredDCId) {
          if (a.dcId === hoveredDCId) return -1;
          if (b.dcId === hoveredDCId) return 1;
        }
        return b.value - a.value;
      });

    const hoveredEntry = plantEntries.find(p => p.dcId === hoveredDCId);

    return (
      <div className="bg-slate-900/95 text-white rounded-xl p-3.5 shadow-2xl border border-slate-700/80 text-xs space-y-2 min-w-[240px] max-w-[320px] backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-1.5">
          <span className="font-bold text-slate-100 text-sm">{label}</span>
          <span className="text-[10px] text-slate-400 tabular-nums">{plantEntries.length} PLTS</span>
        </div>

        {hoveredEntry && (
          <div className="bg-blue-900/50 border border-blue-400/60 rounded-lg p-2 space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 truncate max-w-[150px]">
                <span className="size-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: hoveredEntry.color }} />
                <span className="font-bold text-white truncate">{hoveredEntry.name}</span>
              </div>
              <strong className="text-blue-200 tabular-nums text-sm">{hoveredEntry.value} {unitSuffix}</strong>
            </div>
            <span className="text-[9px] text-blue-300 font-semibold block">Lokasi dipilih</span>
          </div>
        )}

        {plantEntries.length > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold border-b border-slate-800 pb-0.5">
              <span>PLTS</span>
              <span>Nilai ({unitSuffix})</span>
            </div>
            <div className="max-h-[160px] overflow-y-auto space-y-1 pr-1 overscroll-contain">
              {plantEntries.map((p, idx) => {
                const isThisHovered = p.dcId === hoveredDCId;
                return (
                  <div
                    key={idx}
                    className={`flex justify-between items-center text-[11px] tabular-nums py-0.5 px-1.5 rounded transition-colors ${isThisHovered ? 'bg-blue-500/25 text-white font-bold' : 'text-slate-300 hover:bg-slate-800/50'
                      }`}
                  >
                    <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="truncate">{p.name}</span>
                    </div>
                    <strong className="text-white shrink-0">{p.value}</strong>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
}
