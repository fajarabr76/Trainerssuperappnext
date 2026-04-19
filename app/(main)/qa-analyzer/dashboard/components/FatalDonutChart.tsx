import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface CriticalVsNonCriticalData {
  critical: number;
  nonCritical: number;
  total: number;
}

interface FatalDonutChartProps {
  data: CriticalVsNonCriticalData;
}

const DONUT_COLORS = ['#f43f5e', '#64748b']; // Rose for critical, Slate for non-critical

export default function FatalDonutChart({ data }: FatalDonutChartProps) {
  if (!data || data.total === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <PieChart className="w-6 h-6 text-muted-foreground/40" />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Belum Ada Data</p>
      </div>
    );
  }

  const chartData = [
    { name: 'Kritikal', value: data.critical },
    { name: 'Non-Kritikal', value: data.nonCritical },
  ];

  return (
    <div className="h-80 w-full relative flex items-center justify-center animate-in zoom-in duration-700">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="45%"
            innerRadius={70}
            outerRadius={90}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} fillOpacity={0.9} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value) => [value, 'Kasus']}
            contentStyle={{ 
              borderRadius: '12px', 
              border: '1px solid var(--border)', 
              backgroundColor: 'var(--card)', 
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              fontSize: '12px',
              fontWeight: '600',
              color: 'var(--foreground)'
            }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36} 
            iconType="circle" 
            wrapperStyle={{ fontSize: '11px', fontWeight: '600' }}
          />
        </PieChart>
      </ResponsiveContainer>
      
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: '-10%' }}>
        <span className="text-3xl font-bold text-foreground">
          {data.total}
        </span>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total</span>
      </div>
    </div>
  );
}
