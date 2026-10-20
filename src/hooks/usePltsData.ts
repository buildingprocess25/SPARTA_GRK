'use client';

import { useState, useEffect } from 'react';
import { buildCacheKey, buildQueryString } from '@/lib/solar/cacheKey';

// Global client-side in-memory cache singleton across dynamic chunks
const clientCache = typeof window !== 'undefined'
  ? (window.__PLTS_CLIENT_CACHE__ = window.__PLTS_CLIENT_CACHE__ || new Map())
  : new Map();

const CLIENT_CACHE_TTL_MS = 60 * 1000; // 1 minute client freshness window

function getCachedEntry(key) {
  const entry = clientCache.get(key);
  if (!entry) return null;
  // If legacy un-wrapped entry, wrap it
  if (!entry.timestamp) return entry;
  if (Date.now() - entry.timestamp < CLIENT_CACHE_TTL_MS) {
    return entry.data;
  }
  return null;
}

export function prefetchPltsEndpoint(endpoint, filters = {}) {
  const baseKey = buildCacheKey(endpoint, filters);
  if (getCachedEntry(baseKey)) return;

  const qs = buildQueryString(filters);
  fetch(`${endpoint}?${qs}`)
    .then((res) => res.json())
    .then((payload) => {
      if (payload && payload.success) {
        clientCache.set(baseKey, { data: payload.data, timestamp: Date.now() });
      }
    })
    .catch(() => {});
}

export function usePltsEndpoint(endpoint, filters = {}, { enabled = true } = {}) {
  const baseKey = buildCacheKey(endpoint, filters);
  const qs = buildQueryString(filters);

  const [data, setData] = useState(() => getCachedEntry(baseKey) || null);
  const [loading, setLoading] = useState(() => !getCachedEntry(baseKey) && enabled);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) return;

    const cachedData = getCachedEntry(baseKey);
    if (cachedData) {
      setData(cachedData);
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
        clientCache.set(baseKey, { data: result, timestamp: Date.now() });
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
