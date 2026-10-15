export const SPARTA_ROLES = {
  super_admin: {
    id: 'super_admin',
    name: 'Admin Super',
    badge: 'Super Admin',
    badgeColor: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/20',
    description: 'Akses penuh dan tertinggi ke seluruh sistem. Berwenang melakukan maintenance teknis, monitor koneksi database & IoT iSolarCloud, recovery data error, dan kelola akun pengguna.',
    canMaintainSystem: true,
    canManageUsers: true,
    canEditParameters: true,
    canInputData: true,
    canApproveReports: true,
    canViewAllDc: true,
  },
  admin: {
    id: 'admin',
    name: 'Admin Biasa',
    badge: 'Admin ESG',
    badgeColor: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/20',
    description: 'Pengelolaan operasional data emisi harian dan bulanan. Berwenang menginput data Scope 1, Scope 2, PLTS, daur ulang air, dan verifikasi kalkulasi sebelum dilaporkan.',
    canMaintainSystem: false,
    canManageUsers: false,
    canEditParameters: false,
    canInputData: true,
    canApproveReports: false,
    canViewAllDc: true,
  },
  manager: {
    id: 'manager',
    name: 'Manager',
    badge: 'Manager ESG',
    badgeColor: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20',
    description: 'Pengawasan strategis performa keberlanjutan Alfamart nasional. Berwenang mereview ketercapaian target RKAP, mengevaluasi tren penurunan emisi, dan mengesahkan laporan OJK/SRN-PPI.',
    canMaintainSystem: false,
    canManageUsers: false,
    canEditParameters: true,
    canInputData: false,
    canApproveReports: true,
    canViewAllDc: true,
  },
  manager_cabang: {
    id: 'manager_cabang',
    name: 'Manager Cabang',
    badge: 'Branch Manager',
    badgeColor: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/20',
    description: 'Monitoring operasional energi dan kepatuhan lingkungan khusus di DC / Cabang wilayah tugasnya. Mengawasi utilisasi genset dan performa solar rooftop cabang.',
    canMaintainSystem: false,
    canManageUsers: false,
    canEditParameters: false,
    canInputData: false,
    canApproveReports: false,
    canViewAllDc: false,
  },
};

/**
 * Shared display info for login accounts with defined role assignments.
 */
export const PROFILE_BY_USERNAME = {
  valens: {
    nip: 'ALFA-78921-EN',
    roleId: 'admin',
    role: 'Energy & Sustainability Specialist',
    dept: 'Dept. Energy Management & ESG',
    division: 'Operation & Property Division',
    headOffice: 'Alfa Tower lt. 19, Tangerang',
    joinYear: '2022',
  },
  admin: {
    nip: 'ALFA-ADMIN-01',
    roleId: 'super_admin',
    role: 'System Administrator',
    dept: 'Dept. Energy Management & ESG',
    division: 'Operation & Property Division',
    headOffice: 'Alfa Tower lt. 19, Tangerang',
    joinYear: '2026',
  },
  manager_esg: {
    nip: 'ALFA-01045-MGR',
    roleId: 'manager',
    role: 'Head of Sustainability & ESG',
    dept: 'Dept. Energy Management & ESG',
    division: 'Operation & Property Division',
    headOffice: 'Alfa Tower lt. 19, Tangerang',
    joinYear: '2019',
  },
  dc_balaraja: {
    nip: 'ALFA-DC-04-BAL',
    roleId: 'manager_cabang',
    role: 'Branch Manager DC Balaraja',
    dept: 'Distribution Center Balaraja',
    division: 'Branch Operations',
    headOffice: 'DC Balaraja, Tangerang',
    joinYear: '2021',
  },
};

export const DEFAULT_PROFILE = {
  nip: '—',
  roleId: 'admin',
  role: 'Pengguna SPARTA',
  dept: 'Dept. Energy Management & ESG',
  division: 'Operation & Property Division',
  headOffice: 'Alfa Tower, Tangerang',
  joinYear: '—',
};

export function getProfileFor(username) {
  const profile = PROFILE_BY_USERNAME[username] || DEFAULT_PROFILE;
  const roleInfo = SPARTA_ROLES[profile.roleId] || SPARTA_ROLES.admin;
  return { ...profile, roleInfo };
}

export function getInitials(displayName) {
  const words = String(displayName || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

