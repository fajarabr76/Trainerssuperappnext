import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';

interface TeamData {
  name: string;
  total: number;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
}

interface TeamBarChartProps {
  data: TeamData[];
}

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'Critical': return '#ef4444'; // red-500
    case 'High': return '#f97316'; // orange-500
    case 'Medium': return '#eab308'; // yellow-500
    case 'Low': return '#22c55e'; // green-500
    default: return '#8b5cf6'; // violet-500
  }
};

export default function TeamBarChart({ data }: TeamBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-foreground/40 text-sm">
        Tidak ada data temuan untuk tim yang dipilih.
      </div>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="currentColor" opacity={0.1} />
          <XAxis type="number" hide />
          <YAxis 
            dataKey="name" 
            type="category" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'currentColor', fontSize: 12, opacity: 0.6 }} 
            width={100}
          />
          <Tooltip 
            cursor={{ fill: 'var(--foreground)', opacity: 0.05 }}
            contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--foreground)' }}
          />
          <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={24}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getSeverityColor(entry.severity)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
