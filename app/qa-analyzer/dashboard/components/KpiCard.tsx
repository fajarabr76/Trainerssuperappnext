import React from 'react';
import { ResponsiveContainer, LineChart, Line } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

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
  
  let statusColor = 'text-green-500 bg-green-500/10 border-green-500/20';
  let sparklineColor = '#22c55e'; // green-500
  let Icon = ArrowUpRight;

  if (delta === 0) {
    statusColor = 'text-foreground/60 bg-foreground/10 border-border';
    sparklineColor = '#6b7280'; // gray-500
    Icon = Minus;
  } else if (isWarning) {
    statusColor = 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
    sparklineColor = '#eab308'; // yellow-500
    Icon = reverseLogic ? (delta > 0 ? ArrowUpRight : ArrowDownRight) : (delta > 0 ? ArrowUpRight : ArrowDownRight);
  } else if (!isGood) {
    statusColor = 'text-red-500 bg-red-500/10 border-red-500/20';
    sparklineColor = '#ef4444'; // red-500
    Icon = reverseLogic ? ArrowUpRight : ArrowDownRight;
  } else {
    Icon = reverseLogic ? ArrowDownRight : ArrowUpRight;
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-5 flex flex-col justify-between h-full">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm font-medium text-foreground/60 mb-1">{label}</p>
          <div className="flex items-baseline gap-1">
            <h3 className="text-3xl font-bold text-foreground">{value}{unit}</h3>
          </div>
          {target && <p className="text-xs text-foreground/40 mt-1">{target}</p>}
        </div>
        
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-semibold ${statusColor}`}>
          <Icon className="w-3 h-3" />
          <span>{Math.abs(delta)}%</span>
        </div>
      </div>

      <div className="h-12 w-full mt-auto">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <LineChart data={sparklineData}>
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={sparklineColor} 
              strokeWidth={2} 
              dot={false} 
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
