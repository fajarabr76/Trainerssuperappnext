'use client';

import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const COLORS = ['#7C3AED', '#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#6366F1'];

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
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4, fontWeight: 700 }}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4, fontWeight: 700 }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--card)', 
              borderColor: 'var(--border)',
              borderRadius: '16px',
              fontSize: '12px',
              fontWeight: 'bold',
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
              color: 'var(--foreground)'
            }}
          />
          <Legend 
            verticalAlign="top" 
            align="right" 
            iconType="circle"
            wrapperStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', paddingBottom: '20px' }}
          />
          {data.datasets.map((ds, i) => {
            if (!showParameters && !ds.isTotal) return null;
            return (
              <Line
                key={ds.label}
                type="monotone"
                dataKey={ds.label}
                stroke={ds.isTotal ? 'var(--primary)' : COLORS[i % COLORS.length]}
                strokeWidth={ds.isTotal ? 4 : 2}
                strokeDasharray={ds.isTotal ? undefined : '5 5'}
                dot={ds.isTotal ? { r: 4, fill: 'var(--card)', strokeWidth: 2 } : false}
                activeDot={{ r: 6, strokeWidth: 0 }}
                animationDuration={1500}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
