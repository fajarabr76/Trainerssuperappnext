import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { motion } from 'motion/react';

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
      <div className="h-64 flex flex-col items-center justify-center text-muted-foreground text-sm italic">
        <div className="w-12 h-12 rounded-full bg-foreground/5 flex items-center justify-center mb-3">
          <span className="text-xl">📉</span>
        </div>
        Tidak ada data kategori temuan.
      </div>
    );
  }

  return (
    <div className="h-80 w-full animate-in fade-in duration-700">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <ComposedChart data={data} margin={{ top: 20, right: 10, bottom: 20, left: -10 }}>
          <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="currentColor" opacity={0.05} />
          <XAxis 
            dataKey="name" 
            tickFormatter={(value) => value.length > 15 ? `${value.substring(0, 15)}...` : value}
            tick={{ fontSize: 9, fill: 'currentColor', opacity: 0.4, fontWeight: 'bold' }} 
            angle={-30} 
            textAnchor="end"
            height={60}
            axisLine={false}
            tickLine={false}
            dy={5}
          />
          <YAxis 
            yAxisId="left" 
            orientation="left" 
            tick={{ fill: 'currentColor', fontSize: 10, opacity: 0.4, fontWeight: 'bold' }} 
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right" 
            domain={[0, 100]} 
            tickFormatter={v => `${v}%`} 
            tick={{ fill: 'currentColor', fontSize: 10, opacity: 0.4, fontWeight: 'bold' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip 
            formatter={(value, name) => name === 'cumulative' ? [`${value}%`, 'Kumulatif'] : [value, 'Jumlah']}
            labelFormatter={(label, payload) => {
              if (payload && payload.length > 0) {
                return payload[0].payload.fullName;
              }
              return label;
            }}
            contentStyle={{ 
              borderRadius: '16px', 
              border: '1px solid var(--border)', 
              backgroundColor: 'var(--card)', 
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
              fontSize: '11px',
              fontWeight: 'bold',
              color: 'var(--foreground)'
            }}
          />
          <Bar yAxisId="left" dataKey="count" radius={[12, 12, 0, 0]} maxBarSize={40}>
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.category === 'critical' ? '#f43f5e' : 'var(--primary)'} 
                fillOpacity={0.8}
              />
            ))}
          </Bar>
          <Line 
            yAxisId="right" 
            dataKey="cumulative" 
            stroke="#f59e0b" 
            strokeWidth={3}
            dot={{ fill: '#f59e0b', r: 4, strokeWidth: 0 }} 
            activeDot={{ r: 6, strokeWidth: 0 }}
            type="monotone" 
            animationDuration={2000}
          />
          <ReferenceLine
            yAxisId="right"
            y={80}
            stroke="var(--foreground)"
            strokeOpacity={0.3}
            strokeDasharray="6 4"
            label={{ 
              value: '80%', 
              position: 'right', 
              fontSize: 10, 
              fill: 'currentColor', 
              opacity: 0.4,
              fontWeight: 'bold'
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
