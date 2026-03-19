import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ParetoItem {
  name: string;
  fullName: string;
  count: number;
  cumulative: number;
  category: 'critical' | 'non_critical';
}

interface ParetoChartProps {
  data: ParetoItem[];
}

export default function ParetoChart({ data }: ParetoChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-foreground/40 text-sm">
        Tidak ada data kategori temuan.
      </div>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} 
            angle={-30} 
            textAnchor="end"
            height={60}
          />
          <YAxis 
            yAxisId="left" 
            orientation="left" 
            tick={{ fill: 'currentColor', fontSize: 12, opacity: 0.6 }} 
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right" 
            domain={[0, 100]} 
            tickFormatter={v => `${v}%`} 
            tick={{ fill: 'currentColor', fontSize: 12, opacity: 0.6 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip 
            formatter={(value, name) => name === 'cumulative' ? [`${value}%`, 'Kumulatif'] : [value, 'Jumlah Temuan']}
            labelFormatter={(label, payload) => {
              if (payload && payload.length > 0) {
                return payload[0].payload.fullName;
              }
              return label;
            }}
            contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
          />
          <Bar yAxisId="left" dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
          <Line 
            yAxisId="right" 
            dataKey="cumulative" 
            stroke="#ef4444" 
            strokeWidth={2.5}
            dot={{ fill: '#ef4444', r: 4, strokeWidth: 0 }} 
            activeDot={{ r: 6 }}
            type="monotone" 
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
