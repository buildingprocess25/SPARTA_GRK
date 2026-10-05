'use client';

import { useState, useEffect } from 'react';

// Global client-side in-memory cache singleton across dynamic chunks
const clientCache = typeof window !== 'undefined'
  ? (window.__PLTS_CLIENT_CACHE__ = window.__PLTS_CLIENT_CACHE__ || new Map())
  : new Map();

function buildQueryString(filters = {}) {
  const params = new URLSearchParams();
  if (filters.period) params.set('period', filters.period);
  if (filters.mode) params.set('mode', filters.mode);
  if (filters.month) params.set('month', String(filters.month));
  if (filters.throughMonth) params.set('throughMonth', String(filters.throughMonth));
  if (filters.compare) params.set('compare', filters.compare);
  if (filters.grid && filters.grid !== 'ALL') params.set('grid', filters.grid);
  if (filters.plant && filters.plant !== 'ALL') params.set('plant', filters.plant);
  return params.toString();
}

function getBaseCacheKey(endpoint, filters = {}) {
  const qs = buildQueryString(filters);
  return `${endpoint}?${qs}`;
}

export function prefetchPltsEndpoint(endpoint, filters = {}) {
  const baseKey = getBaseCacheKey(endpoint, filters);
  if (clientCache.has(baseKey)) return;

  const qs = buildQueryString(filters);
  fetch(`${endpoint}?${qs}`)
    .then((res) => res.json())
    .then((payload) => {
      if (payload && payload.success) {
        clientCache.set(baseKey, payload.data);
      }
    })
    .catch(() => {});
}

export function usePltsEndpoint(endpoint, filters = {}, { enabled = true } = {}) {
  const baseKey = getBaseCacheKey(endpoint, filters);
  const qs = buildQueryString(filters);

  const [data, setData] = useState(() => clientCache.get(baseKey) || null);
  const [loading, setLoading] = useState(() => !clientCache.has(baseKey) && enabled);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) return;

    // If cache hit on base key, render immediately with 0 network requests
    if (clientCache.has(baseKey)) {
      setData(clientCache.get(baseKey));
      setLoading(false);
      setError(null);
      return;
    }

    let isCurrent = true;
    setLoading(true);
    setError(null);

    fetch(`${endpoint}?${qs}`)
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok || !payload.success) {
          throw new Error(payload.error || `HTTP ${res.status}`);
        }
        return payload.data;
      })
      .then((result) => {
        if (!isCurrent) return;
        clientCache.set(baseKey, result);
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        if (!isCurrent) return;
        setError(err.message || 'Gagal memuat data PLTS');
        setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseKey, enabled, endpoint]);

  return { data, loading, error };
}
