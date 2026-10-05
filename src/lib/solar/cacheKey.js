/**
 * Pure Utility for building unified cache keys and query strings
 * for PLTS Client Cache and Endpoint Prefetching.
 */

export function buildQueryString(filters = {}) {
  const params = new URLSearchParams();
  if (filters.period) params.set('period', filters.period);
  if (filters.mode) params.set('mode', filters.mode);
  if (filters.year) params.set('year', String(filters.year));
  if (filters.month) params.set('month', String(filters.month));
  if (filters.throughMonth) params.set('throughMonth', String(filters.throughMonth));
  if (filters.compare) params.set('compare', filters.compare);
  if (filters.grid && filters.grid !== 'ALL') params.set('grid', filters.grid);
  if (filters.plant && filters.plant !== 'ALL') params.set('plant', filters.plant);
  return params.toString();
}

export function buildCacheKey(endpoint, filters = {}) {
  const ep = String(endpoint || '').trim();
  const qs = buildQueryString(filters);
  return qs ? `${ep}?${qs}` : ep;
}
