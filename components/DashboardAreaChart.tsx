'use client';

import React, { useId, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface ChartPoint {
  date: string;
  value: number;
}

type ChartMode = 'area' | 'line' | 'bar';

function formatAxisDollar(value: number | string): string {
  const num = Number(value);
  if (Number.isNaN(num)) return '$0';
  return num.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function formatTooltipDollar(value: number | string | undefined): string {
  const num = Number(value ?? 0);
  if (Number.isNaN(num)) return '$0.00';
  return num.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function DashboardChartFallback() {
  return (
    <div
      className="h-72 w-full rounded-xl border border-[#263437] bg-[#0A0F11] p-4 motion-safe:animate-pulse"
      role="status"
      aria-label="Loading portfolio chart"
    >
      <div className="h-full w-full rounded-lg bg-[#141C1F]" />
      <span className="sr-only">Loading portfolio chart…</span>
    </div>
  );
}

function ChartEmptyState() {
  return (
    <div
      className="flex h-72 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#263437] bg-[#0A0F11] p-6 text-center"
      role="status"
    >
      <p className="text-sm font-medium text-[#F3F7F4]">No performance data yet</p>
      <p className="max-w-xs text-xs leading-relaxed text-[#93A09A]">
        Your portfolio chart will appear after your first approved deposit is recorded.
      </p>
    </div>
  );
}

function ModeButton({
  chartMode,
  active,
  onSelect,
}: {
  chartMode: ChartMode;
  active: boolean;
  onSelect: (mode: ChartMode) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(chartMode)}
      aria-pressed={active}
      className={`min-h-9 min-w-11 px-3 py-2 rounded-md text-[10px] uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0F11] ${
        active
          ? 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/40'
          : 'text-[#93A09A] border border-transparent hover:border-[#263437] hover:text-[#F3F7F4] motion-safe:transition-colors'
      }`}
    >
      {chartMode}
    </button>
  );
}

export default function DashboardAreaChart({ chartData }: { chartData: ChartPoint[] }) {
  const [mode, setMode] = React.useState<ChartMode>('area');
  const gradientId = useId();
  const points = useMemo(() => (Array.isArray(chartData) ? chartData : []), [chartData]);

  if (points.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-end gap-1 mb-2" role="group" aria-label="Chart type">
          {(['area', 'line', 'bar'] as ChartMode[]).map((chartMode) => (
            <ModeButton key={chartMode} chartMode={chartMode} active={mode === chartMode} onSelect={setMode} />
          ))}
        </div>
        <ChartEmptyState />
      </div>
    );
  }

  const sharedAxes = (
    <>
      <CartesianGrid stroke="#263437" strokeDasharray="3 3" vertical={false} />
      <XAxis
        dataKey="date"
        stroke="#A8ACB3"
        fontSize={11}
        tickLine={false}
        axisLine={false}
        interval="preserveStart"
        minTickGap={24}
      />
      <YAxis
        stroke="#A8ACB3"
        fontSize={11}
        tickLine={false}
        axisLine={false}
        width={64}
        domain={['dataMin - 100', 'dataMax + 100']}
        tickFormatter={formatAxisDollar}
      />
      <Tooltip
        contentStyle={{
          backgroundColor: '#12161A',
          borderColor: '#202722',
          borderRadius: '12px',
          fontSize: '12px',
          color: '#FFF',
        }}
        formatter={(value) => [formatTooltipDollar(value as number), 'Portfolio value']}
        labelStyle={{ color: '#A8ACB3' }}
      />
    </>
  );

  return (
    <div>
      <div className="flex items-center justify-end gap-1 mb-2" role="group" aria-label="Chart type">
        {(['area', 'line', 'bar'] as ChartMode[]).map((chartMode) => (
          <ModeButton key={chartMode} chartMode={chartMode} active={mode === chartMode} onSelect={setMode} />
        ))}
      </div>
      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {mode === 'bar' ? (
            <BarChart data={points}>
              {sharedAxes}
              <Bar dataKey="value" fill="#22C55E" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          ) : mode === 'line' ? (
            <LineChart data={points}>
              {sharedAxes}
              <Line
                type="monotone"
                dataKey="value"
                stroke="#22C55E"
                strokeWidth={3}
                dot={{ r: 3, fill: '#22C55E', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          ) : (
            <AreaChart data={points}>
              {sharedAxes}
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22C55E" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="#22C55E"
                strokeWidth={3}
                fillOpacity={1}
                fill={`url(#${gradientId})`}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
