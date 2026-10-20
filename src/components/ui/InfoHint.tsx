'use client';

import MetricInfoIcon from '@/components/ui/MetricInfoIcon';

/** An "i" icon that shows a short explanation on hover, click, or keyboard focus. */
export default function InfoHint({ title, text, className = '', size = 14 }) {
  if (!text) return null;
  return <MetricInfoIcon overrideInfo={{ title, definition: text }} className={className} size={size} />;
}
