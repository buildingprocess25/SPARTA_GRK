import { Building2, Bus, Car, Factory, HandCoins, Leaf, Plane, ReceiptText, Sun, Zap } from 'lucide-react';

export const CALCULATOR_CATEGORIES = [
  { id: 'scope1a', kind: 'addition', title: 'Scope 1A — Emisi Mesin Bakar Statis', description: 'Emisi dari genset, pemanas air, kompor, dan mesin tidak bergerak.', icon: Factory },
  { id: 'scope1b', kind: 'addition', title: 'Scope 1B — Emisi Mesin Bakar Bergerak', description: 'Emisi dari pemakaian BBM atau jarak tempuh kendaraan.', icon: Bus },
  { id: 'scope2', kind: 'addition', title: 'Scope 2 — Pemakaian Listrik dari PLN', description: 'Emisi dari listrik yang dibeli dari jaringan PLN.', icon: Zap },
  { id: 'travel', kind: 'addition', title: 'Scope 3 — Perjalanan Dinas', description: 'Emisi perjalanan pesawat, kereta api, dan akomodasi hotel.', icon: Plane },
  { id: 'financed', kind: 'addition', title: 'Scope 3 — Emisi yang Dibiayai', description: 'Emisi dari portofolio investasi dan pinjaman lembaga keuangan.', icon: HandCoins, optional: true },
  { id: 'offset', kind: 'reduction', title: 'Carbon Offset', description: 'Pengurangan melalui sertifikat atau instrumen carbon offset.', icon: ReceiptText },
  { id: 'ev', kind: 'reduction', title: 'Pemanfaatan Kendaraan Listrik', description: 'Pengurangan melalui penggunaan kendaraan listrik.', icon: Car },
  { id: 'renewable', kind: 'reduction', title: 'Pemanfaatan Energi Baru dan Terbarukan', description: 'Pengurangan melalui PLTS atau energi terbarukan lainnya.', icon: Leaf },
  { id: 'kkb', kind: 'reduction', title: 'Kredit Kendaraan Bermotor Listrik', description: 'Pengurangan dari kendaraan listrik yang dibiayai.', icon: Sun },
  { id: 'green_security', kind: 'reduction', title: 'Surat Berharga Hijau', description: 'Pengurangan dari kepemilikan instrumen pembiayaan hijau.', icon: Building2 },
];

export const CATEGORY_MAP = Object.fromEntries(CALCULATOR_CATEGORIES.map(item => [item.id, item]));
