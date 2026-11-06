import { GRID_EMISSION_FACTORS, GRID_FACTOR_KG_PER_KWH } from '../emission-factors.ts';

// Stores take the PLN grid of their branch. A branch serving stores on another grid would need store-level mapping.
export const STORE_BRANCH_GRID: Readonly<Record<string, string>> = Object.freeze({
  JZ01: 'JAMALI', // Cileungsi2
  KZ01: 'JAMALI', // Cikokol
  BZ01: 'JAMALI', // Bandung
  UZ01: 'JAMALI', // Sidoarjo
  '2AZ1': 'JAMALI', // Rembang
  '2MZ1': 'JAMALI', // Madiun
  VZ01: 'JAMALI', // Plumbon
  '2PZ1': 'JAMALI', // Tegal
  OZ01: 'JAMALI', // Klaten
  IZ01: 'JAMALI', // Cilacap
  MZ01: 'JAMALI', // Malang
  '2JZ1': 'JAMALI', // Cianjur
  QZ01: 'JAMALI', // Bali
  HZ01: 'JAMALI', // Semarang
  YZ01: 'JAMALI', // Jember
  '6A00': 'JAMALI', // NCH Semanan
  '6B00': 'JAMALI', // NCH Jogja
  '6C00': 'JAMALI', // NCH Sidoarjo
  LZ01: 'SUMATERA', // Lampung
  PZ01: 'SUMATERA', // Palembang
  WZ01: 'SUMATERA', // Medan
  '1AZ1': 'SUMATERA', // Pekanbaru
  '1DZ1': 'SUMATERA', // Jambi
  '2DZ1': 'BATAM', // Batam
  '1SZ1': 'NTB_LOMBOK', // Lombok
  '1PZ1': 'KALBAR', // Pontianak
  '1GZ1': 'KALSELTENG', // Banjarmasin
  RZ01: 'SULSELRABAR', // Makassar
  '2VZ1': 'SULSELRABAR', // Luwu
  '2SZ1': 'SULUTGO', // Gorontalo
  '1YZ1': 'SULUTGO', // Manado
});

export function gridForStoreBranch(branchCode: string) {
  const grid = STORE_BRANCH_GRID[branchCode];
  if (!grid) return null;
  const factor = GRID_FACTOR_KG_PER_KWH[grid];
  return factor === undefined ? null : { grid, factor };
}

export function gridFactorStatus(grid: string) {
  return GRID_EMISSION_FACTORS.find(item => item.grid === grid)?.status ?? 'sementara';
}
