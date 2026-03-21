import React from 'react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Minus, Target } from 'lucide-react';
import { motion } from 'motion/react';

interface SparklineData {
  label: string;
  value: number;
}

interface KpiCardProps {
  label: string;
  value: number | string;
  delta: number;
  target?: string;
  reverseLogic: boolean;
  sparklineData: SparklineData[];
  unit?: string;
}

export default function KpiCard({
  label,
  value,
  delta,
  target,
  reverseLogic,
  sparklineData,
  unit = ''
}: KpiCardProps) {
  const isGood = reverseLogic ? delta <= 0 : delta >= 0;
  const isWarning = Math.abs(delta) < 5 && delta !== 0;
  
  let statusColor = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
  let sparklineColor = '#10b981'; // emerald-500
  let Icon = ArrowUpRight;

  if (delta === 0) {
    statusColor = 'text-foreground/40 bg-foreground/5 border-border/50';
    sparklineColor = '#6b7280'; // gray-500
    Icon = Minus;
  } else if (isWarning) {
    statusColor = 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    sparklineColor = '#f59e0b'; // amber-500
    Icon = reverseLogic ? (delta > 0 ? ArrowUpRight : ArrowDownRight) : (delta > 0 ? ArrowUpRight : ArrowDownRight);
  } else if (!isGood) {
    statusColor = 'text-rose-500 bg-rose-500/10 border-rose-500/20';
    sparklineColor = '#f43f5e'; // rose-500
    Icon = reverseLogic ? ArrowUpRight : ArrowDownRight;
  } else {
    Icon = reverseLogic ? ArrowDownRight : ArrowUpRight;
  }

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="bg-card/50 backdrop-blur-xl rounded-[2.5rem] border border-border/50 p-6 flex flex-col justify-between h-full group hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 relative overflow-hidden"
    >
      {/* Background glow */}
      <div className={`absolute -right-8 -top-8 w-32 h-32 opacity-[0.03] rounded-full blur-3xl transition-colors duration-700 group-hover:opacity-10`} style={{ backgroundColor: sparklineColor }} />

      <div className="flex justify-between items-start mb-6 relative z-10">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 group-hover:text-primary/60 transition-colors">{label}</p>
          <div className="flex items-baseline gap-1.5">
            <h3 className="text-4xl font-black tracking-tighter text-foreground tabular-nums">{value}<span className="text-xl opacity-30 ml-0.5">{unit}</span></h3>
          </div>
          {target && (
            <div className="flex items-center gap-1.5 mt-2 opacity-40">
              <Target className="w-3 h-3" />
              <span className="text-[9px] font-bold tracking-wider uppercase">{target}</span>
            </div>
          )}
        </div>
        
        <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-[10px] font-black tracking-widest uppercase shadow-sm ${statusColor}`}>
          <Icon className="w-3.5 h-3.5" />
          <span>{Math.abs(delta)}%</span>
        </div>
      </div>

      <div className="h-16 w-full -mx-6 mt-2 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-card/80 via-transparent to-card/80 z-10" />
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparklineData}>
            <defs>
              <linearGradient id={`gradient-${label.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={sparklineColor} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={sparklineColor} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={sparklineColor} 
              strokeWidth={3} 
              fillOpacity={1} 
              fill={`url(#gradient-${label.replace(/\s+/g, '-')})`}
              isAnimationActive={true}
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
