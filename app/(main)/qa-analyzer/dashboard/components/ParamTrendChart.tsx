'use client';

import React from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart
} from 'recharts';

const TREND_COLORS = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#6366f1'];

export default function ParamTrendChart({ data, showParameters = true }: { data: { labels: string[], datasets: any[] }, showParameters?: boolean }) {
  if (!data || !data.labels.length) return null;

  const chartData = data.labels.map((label, i) => {
    const point: any = { name: label };
    data.datasets.forEach(ds => {
      point[ds.label] = ds.data[i];
    });
    return point;
  });

  return (
    <div className="h-[350px] w-full animate-in slide-in-from-right duration-1000">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="totalTrendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2}/>
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="currentColor" opacity={0.05} />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 9, fill: 'currentColor', opacity: 0.4, fontWeight: 'bold' }}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 9, fill: 'currentColor', opacity: 0.4, fontWeight: 'bold' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--card)', 
              borderColor: 'var(--border)',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 'bold',
              boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
              color: 'var(--foreground)',
              padding: '12px'
            }}
          />
          <Legend 
            verticalAlign="top" 
            align="right" 
            iconType="circle"
            wrapperStyle={{ fontSize: '9px', fontWeight: 'black', textTransform: 'uppercase', letterSpacing: '0.1em', paddingBottom: '30px' }}
          />
          {showParameters && data.datasets.map((ds: any, i: number) => {
            if (ds.isTotal) return null;
            return (
              <Area
                key={ds.label}
                type="monotone"
                dataKey={ds.label}
                stackId="1"
                stroke={TREND_COLORS[i % TREND_COLORS.length]}
                strokeWidth={2}
                fill={TREND_COLORS[i % TREND_COLORS.length]}
                fillOpacity={0.1}
                isAnimationActive={true}
                animationDuration={1500}
              />
            );
          })}
          {data.datasets.map((ds: any, i: number) => {
            if (!ds.isTotal) return null;
            return (
              <Area
                key={ds.label}
                type="monotone"
                dataKey={ds.label}
                stroke="var(--primary)"
                strokeWidth={4}
                fill="url(#totalTrendGradient)"
                fillOpacity={1}
                isAnimationActive={true}
                animationDuration={2000}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
