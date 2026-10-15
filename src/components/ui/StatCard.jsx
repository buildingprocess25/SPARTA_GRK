import React from 'react';
import KpiCard from '@/components/ui/KpiCard';

export default function StatCard({
  title,
  value,
  unit,
  trendText,
  icon: _icon, // Removed decorative bare icons
  theme = 'default',
  sourceBadge: _sourceBadge = null, // Ignored: raw source codes are not shown to users.
  tooltip = null,
  infoKey = null,
  className = '',
  ...props
}) {
  return (
    <KpiCard
      label={title}
      value={value}
      unit={unit}
      trend={trendText}
      theme={theme}
      tooltip={tooltip}
      infoKey={infoKey}
      className={className}
      {...props}
    />
  );
}
