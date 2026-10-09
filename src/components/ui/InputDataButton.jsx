'use client';

import { Plus } from 'lucide-react';

export default function InputDataButton({ label = 'Input Data', icon: Icon = Plus, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${className}`}
    >
      <Icon size={17} />
      <span>{label}</span>
    </button>
  );
}
