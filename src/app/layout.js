import './globals.css';
import OverlayProviders from '@/components/ui/OverlayProviders';

export const metadata = {
  title: 'Alfamart - Dashboard Sustainability Energy & Water',
  description: 'Real-time monitoring dashboard untuk pengelolaan energi (PLTS) dan air (Water Recycle) pada Distribution Center Alfamart.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body suppressHydrationWarning className="bg-slate-50 text-slate-800">
        <OverlayProviders>{children}</OverlayProviders>
      </body>
    </html>
  );
}
