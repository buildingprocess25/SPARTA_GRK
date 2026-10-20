'use client';

import * as React from 'react';
import * as RechartsPrimitive from 'recharts';
import { cn } from '@/lib/utils';

export type ChartConfig = Record<string, { label?: React.ReactNode; color?: string; theme?: { light?: string; dark?: string }; icon?: React.ComponentType }>;

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null);

export function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error('useChart must be used within a <ChartContainer />');
  }
  return context;
}

export const ChartContainer = React.forwardRef<any, { [key: string]: any } & { id?: any; className?: any; children?: any; config?: any; [key: string]: any }>(function ChartContainer(
  { id, className, children, config = {}, ...props },
  ref
) {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, '')}`;
  const size = useElementSize();
  const setRefs = React.useCallback((node) => {
    size.ref(node);
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [ref, size.ref]);

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        ref={setRefs}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-slate-500 [&_.recharts-cartesian-grid_line]:stroke-slate-200/80 dark:[&_.recharts-cartesian-grid_line]:stroke-slate-800/80 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-slate-300 dark:[&_.recharts-curve.recharts-tooltip-cursor]:stroke-slate-700 [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-slate-200 dark:[&_.recharts-polar-grid_[stroke='#ccc']]:stroke-slate-800 [&_.recharts-radial-bar-background-sector]:fill-slate-100 dark:[&_.recharts-radial-bar-background-sector]:fill-slate-800 [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-slate-100/60 dark:[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-slate-800/40 [&_.recharts-reference-line_[stroke='#ccc']]:stroke-slate-300 dark:[&_.recharts-reference-line_[stroke='#ccc']]:stroke-slate-700 [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        {size.width > 0 && size.height > 0 && React.isValidElement(children)
          ? React.cloneElement(children as React.ReactElement<any>, { width: size.width, height: size.height })
          : null}
      </div>
    </ChartContext.Provider>
  );
});

// Charts get their size as props instead of through Recharts' ResponsiveContainer context, which intermittently
// never reached charts rendered inside this wrapper (the chart store stayed at 0×0 and drew nothing).
function useElementSize() {
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const observerRef = React.useRef(null);
  const ref = React.useCallback((node) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const width = Math.floor(node.clientWidth);
      const height = Math.floor(node.clientHeight);
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    };
    update();
    observerRef.current = new ResizeObserver(update);
    observerRef.current.observe(node);
  }, []);
  return { ...size, ref };
}

export function ChartStyle({ id, config }: { id?: string; config?: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(
    ([_, item]) => item.theme || item.color
  );

  if (!colorConfig.length) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(config)
          .map(([key, item]) => {
            const color = item.color || item.theme?.light;
            const darkColor = item.theme?.dark || color;
            return `
              [data-chart=${id}] {
                --color-${key}: ${color};
              }
              .dark [data-chart=${id}] {
                --color-${key}: ${darkColor};
              }
            `;
          })
          .join('\n'),
      }}
    />
  );
}

export const ChartTooltip = RechartsPrimitive.Tooltip;

export const ChartTooltipContent = React.forwardRef<React.ElementRef<'div'>, React.ComponentPropsWithoutRef<'div'> & { active?: any; payload?: any; className?: any; indicator?: string; hideLabel?: boolean; hideIndicator?: boolean; label?: any; labelFormatter?: any; labelClassName?: any; formatter?: any; color?: any; nameKey?: any; labelKey?: any; [key: string]: any }>(function ChartTooltipContent(
  {
    active,
    payload,
    className,
    indicator = 'dot',
    hideLabel = false,
    hideIndicator = false,
    label,
    labelFormatter,
    labelClassName,
    formatter,
    color,
    nameKey,
    labelKey,
  },
  ref
) {
  const { config } = useChart();

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) {
      return null;
    }

    const [item] = payload;
    const key = `${labelKey || item?.dataKey || item?.name || 'value'}`;
    const itemConfig = config[key] || {};
    const value =
      !labelKey && typeof label === 'string'
        ? config[label]?.label || label
        : itemConfig?.label;

    if (labelFormatter) {
      return (
        <div className={cn('font-bold text-slate-900 dark:text-slate-100 text-xs mb-1', labelClassName)}>
          {labelFormatter(value, payload)}
        </div>
      );
    }

    if (!value) {
      return null;
    }

    return <div className={cn('font-bold text-slate-900 dark:text-slate-100 text-xs mb-1', labelClassName)}>{value}</div>;
  }, [
    label,
    labelFormatter,
    payload,
    hideLabel,
    labelClassName,
    config,
    labelKey,
  ]);

  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn(
        'grid min-w-[8rem] items-start gap-1.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-100',
        className
      )}
    >
      {tooltipLabel}
      <div className="grid gap-1">
        {payload.map((item, index) => {
          const key = `${nameKey || item.name || item.dataKey || 'value'}`;
          const itemConfig = config[key] || {};
          const indicatorColor = color || item.payload.fill || item.color;

          return (
            <div
              key={item.dataKey || index}
              className={cn(
                'flex w-full items-center justify-between gap-3 text-xs',
                indicator === 'dot' && 'items-center'
              )}
            >
              <div className="flex items-center gap-1.5">
                {!hideIndicator && (
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: indicatorColor,
                    }}
                  />
                )}
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  {itemConfig?.label || item.name}
                </span>
              </div>
              <span className="tabular-nums font-bold text-slate-900 dark:text-slate-100">
                {formatter && item?.value !== undefined
                  ? formatter(item.value, item.name, item, index, item.payload)
                  : typeof item.value === 'number'
                  ? item.value.toLocaleString('id-ID')
                  : item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export const ChartLegend = RechartsPrimitive.Legend;

export const ChartLegendContent = React.forwardRef<React.ElementRef<'div'>, React.ComponentPropsWithoutRef<'div'> & { className?: any; hideIcon?: boolean; payload?: any; verticalAlign?: string; nameKey?: any; [key: string]: any }>(function ChartLegendContent(
  { className, hideIcon = false, payload, verticalAlign: _verticalAlign = 'bottom', nameKey },
  ref
) {
  const { config } = useChart();

  if (!payload?.length) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn('flex items-center justify-center gap-4 pt-3 flex-wrap', className)}
    >
      {payload.map((item) => {
        const key = `${nameKey || item.dataKey || 'value'}`;
        const itemConfig = config[key] || {};

        return (
          <div
            key={item.value}
            className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium"
          >
            {!hideIcon && (
              <span
                className="size-2 shrink-0 rounded-full"
                style={{
                  backgroundColor: item.color,
                }}
              />
            )}
            <span>{itemConfig?.label || item.value}</span>
          </div>
        );
      })}
    </div>
  );
});

export default ChartContainer;
