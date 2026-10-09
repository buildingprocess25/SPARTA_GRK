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

const THEME_INIT_SCRIPT = `(function () {
  try {
    var stored = localStorage.getItem('sparta-theme');
    var isDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body suppressHydrationWarning className="bg-slate-50 text-slate-800 dark:bg-[#0B1220] dark:text-slate-100">
        {/* Runs before paint to set the .dark class from saved/OS preference, avoiding a light->dark flash */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <OverlayProviders>{children}</OverlayProviders>
      </body>
    </html>
  );
}
