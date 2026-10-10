/**
 * Shared display info for the 2-fixed-account login (see src/lib/auth.js).
 * Not a real HR/SSO record - flavor text keyed by username, used by both
 * Header.jsx (profile modal) and Sidebar.jsx (footer card) so they never
 * show mismatched info for whichever account is actually logged in.
 */
export const PROFILE_BY_USERNAME = {
  valens: {
    nip: 'ALFA-78921-EN',
    role: 'Energy & Sustainability Specialist',
    dept: 'Dept. Energy Management & ESG',
    division: 'Operation & Property Division',
    headOffice: 'Alfa Tower lt. 19, Tangerang',
    joinYear: '2022',
  },
  admin: {
    nip: 'ALFA-ADMIN',
    role: 'System Administrator',
    dept: 'Dept. Energy Management & ESG',
    division: 'Operation & Property Division',
    headOffice: 'Alfa Tower lt. 19, Tangerang',
    joinYear: '2026',
  },
};

export const DEFAULT_PROFILE = {
  nip: '—',
  role: 'Pengguna SPARTA',
  dept: '—',
  division: '—',
  headOffice: 'Alfa Tower, Tangerang',
  joinYear: '—',
};

export function getProfileFor(username) {
  return PROFILE_BY_USERNAME[username] || DEFAULT_PROFILE;
}

export function getInitials(displayName) {
  const words = String(displayName || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
