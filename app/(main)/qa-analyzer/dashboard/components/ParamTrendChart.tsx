'use client';

import React from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';

export const TREND_COLORS = [
  '#A855F7', // Purple
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#06B6D4'  // Cyan
];

export default function ParamTrendChart({ 
  data, 
  showParameters = true,
  filterLabel = 'all',
  hiddenKeys = new Set<string>(),
  hideTotal = false
}: { 
  data: { labels: string[], datasets: any[] }, 
  showParameters?: boolean,
  filterLabel?: string,
  hiddenKeys?: Set<string>,
  hideTotal?: boolean
}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!data || !data.labels.length) return null;

  // FIX: Gunakan dataset_{index} sebagai key (bukan ds.label) untuk menghindari
  // Recharts dot-notation bug pada label yang mengandung titik (e.g. "1.1 Greeting")
  const chartData = data.labels.map((label, i) => {
    const point: any = { name: label };
    data.datasets.forEach((ds, dsIndex) => {
      point[`dataset_${dsIndex}`] = ds.data[i];
    });
    return point;
  });

  if (!mounted) return <div className="h-full w-full bg-muted/10 animate-pulse rounded-3xl" />;

  const isFiltered = filterLabel !== 'all';

  return (
    <div className="h-full w-full animate-in fade-in duration-700">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="totalTrendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5, fontWeight: 600 }}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5, fontWeight: 600 }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))', 
              borderColor: 'hsl(var(--border))',
              borderRadius: '16px',
              fontSize: '12px',
              fontWeight: '600',
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
              color: 'hsl(var(--foreground))',
              borderWidth: '1px'
            }}
          />
          
          {showParameters && data.datasets.map((ds: any, i: number) => {
            if (ds.isTotal) return null;
            if (isFiltered && ds.label !== filterLabel) return null;
            if (!isFiltered && hiddenKeys.has(ds.label)) return null;
            
            const color = TREND_COLORS[i % TREND_COLORS.length];
            return (
              <Area
                key={ds.label}
                name={ds.label}
                type="monotone"
                dataKey={`dataset_${i}`}
                // FIX: stackId dihapus agar setiap area dirender berdasarkan nilai absolutnya,
                // bukan ditumpuk secara kumulatif yang menyebabkan semua garis terlihat identik
                stroke={color}
                strokeWidth={isFiltered ? 4 : 2}
                fill={color}
                fillOpacity={isFiltered ? 0.3 : 0.15}
                isAnimationActive={true}
                animationDuration={1000}
                dot={isFiltered ? { r: 4, fill: 'hsl(var(--card))', strokeWidth: 2, stroke: color } : false}
              />
            );
          })}
          
          {data.datasets.map((ds: any, i: number) => {
            if (!ds.isTotal) return null;
            if (hideTotal) return null;
            if (isFiltered && ds.label !== filterLabel) return null;
            
            return (
              <Area
                key={ds.label}
                name={ds.label}
                type="monotone"
                dataKey={`dataset_${i}`}
                stroke="hsl(var(--primary))"
                strokeWidth={4}
                fill="url(#totalTrendGradient)"
                fillOpacity={1}
                isAnimationActive={true}
                animationDuration={1500}
                dot={{ r: 4, fill: 'hsl(var(--card))', strokeWidth: 2, stroke: 'hsl(var(--primary))' }}
                activeDot={{ r: 6, strokeWidth: 0, fill: 'hsl(var(--primary))' }}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
