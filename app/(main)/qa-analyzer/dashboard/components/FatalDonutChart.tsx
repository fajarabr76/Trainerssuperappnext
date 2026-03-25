import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { motion } from 'motion/react';

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
      <div className="h-64 flex flex-col items-center justify-center text-foreground/30 text-sm italic">
        <div className="w-12 h-12 rounded-full bg-foreground/5 flex items-center justify-center mb-3">
          <span className="text-xl">🍩</span>
        </div>
        No Case Data.
      </div>
    );
  }

  const chartData = [
    { name: 'Critical Parameter', value: data.critical },
    { name: 'Non-Critical', value: data.nonCritical },
  ];

  return (
    <div className="h-80 w-full relative group animate-in zoom-in duration-700">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="45%"
            innerRadius={65}
            outerRadius={85}
            paddingAngle={8}
            dataKey="value"
            stroke="none"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} fillOpacity={0.8} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value) => [value, 'Kasus']}
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
          <Legend 
            verticalAlign="bottom" 
            height={36} 
            iconType="circle" 
            wrapperStyle={{ fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase', letterSpacing: '0.1em' }}
          />
        </PieChart>
      </ResponsiveContainer>
      
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: '-10%' }}>
        <motion.span 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="text-4xl font-black text-foreground tabular-nums"
        >
          {data.total}
        </motion.span>
        <span className="text-[10px] font-black uppercase tracking-widest text-foreground/30 mb-1">Total Temuan</span>
        <div className="flex gap-3">
          <span className="text-[9px] font-black text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded-md">CRITICAL: {data.critical}</span>
          <span className="text-[9px] font-black text-slate-500 bg-slate-500/10 px-1.5 py-0.5 rounded-md">NON: {data.nonCritical}</span>
        </div>
      </div>
    </div>
  );
}
