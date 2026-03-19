import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface FatalVsNonFatalData {
  fatal: number;
  nonFatal: number;
  total: number;
}

interface FatalDonutChartProps {
  data: FatalVsNonFatalData;
}

const COLORS = ['#ef4444', '#eab308']; // Red for fatal, Yellow for non-fatal

export default function FatalDonutChart({ data }: FatalDonutChartProps) {
  if (!data || data.total === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-foreground/40 text-sm">
        Tidak ada data fatal vs non-fatal.
      </div>
    );
  }

  const chartData = [
    { name: 'Fatal Error', value: data.fatal },
    { name: 'Non-Fatal Error', value: data.nonFatal },
  ];

  return (
    <div className="h-80 w-full relative">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="45%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value) => [value, 'Jumlah']}
            contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
          />
          <Legend verticalAlign="bottom" height={36} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
      
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: '-10%' }}>
        <span className="text-3xl font-bold text-foreground">{data.total}</span>
        <span className="text-xs text-foreground/60">Total Temuan</span>
      </div>
    </div>
  );
}
