// Client-side caches the PLTS dashboard keeps on window so they survive remounts.
declare module '*.css';

interface Window {
  __PLTS_CLIENT_CACHE__?: Map<string, unknown>;
  __PLTS_OVERVIEW_CLIENT_CACHE__?: Map<string, any>;
  __PLTS_SUMMARY_CACHE__?: Map<string, any>;
}
