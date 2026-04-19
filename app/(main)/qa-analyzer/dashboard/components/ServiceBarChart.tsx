import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { ServiceComparisonData, SERVICE_LABELS } from '../../lib/qa-types';
import QaStatePanel from '../../components/QaStatePanel';

interface ServiceBarChartProps {
  data: ServiceComparisonData[];
}

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'Critical': return '#f43f5e'; // rose-500
    case 'High': return '#f59e0b'; // amber-500
    case 'Medium': return '#3b82f6'; // blue-500
    case 'Low': return '#10b981'; // emerald-500
    default: return '#8b5cf6'; // violet-500
  }
};

export default function ServiceBarChart({ data }: ServiceBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <QaStatePanel
          type="empty"
          compact
          title="Data temuan per layanan belum tersedia"
          description="Data akan tampil setelah periode dan filter menghasilkan temuan."
          className="max-w-sm"
        />
      </div>
    );
  }

  const chartData = [...(data ?? [])]
    .filter((d): d is typeof d & { total: number } => 
      !!d && typeof d.total === "number"
    )
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      const typeA = String(a.serviceType ?? 'unknown');
      const typeB = String(b.serviceType ?? 'unknown');
      return typeA.localeCompare(typeB);
    })
    .map((d) => {
      const safeType = d.serviceType ?? "unknown";
      const baseName = SERVICE_LABELS[safeType as keyof typeof SERVICE_LABELS] || d.name || safeType;
      return {
        ...d,
        displayName: baseName,           // Pendek untuk axis
        fullLabel: `${baseName} (${safeType})`, // Informatif untuk tooltip
      };
    });

  return (
    <div className="h-full w-full flex flex-col animate-in fade-in duration-700">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="5 5" horizontal={true} vertical={false} stroke="currentColor" opacity={0.05} />
            <XAxis type="number" hide />
            <YAxis 
              dataKey="displayName" 
              type="category" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'currentColor', fontSize: 11, opacity: 0.6 }} 
              width={85}
            />
            <Tooltip 
              cursor={{ fill: 'currentColor', opacity: 0.03 }}
              contentStyle={{ 
                borderRadius: '8px', 
                border: '1px solid var(--border)', 
                backgroundColor: 'var(--card)', 
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                fontSize: '12px',
                fontWeight: '500',
                color: 'var(--foreground)'
              }}
            />
            <Bar dataKey="total" radius={[0, 8, 8, 0]} barSize={24}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getSeverityColor(entry.severity)} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Severity Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2 pt-2 border-t border-border/30">
        {[
          { label: 'Critical', color: '#f43f5e' },
          { label: 'High', color: '#f59e0b' },
          { label: 'Medium', color: '#3b82f6' },
          { label: 'Low', color: '#10b981' }
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
