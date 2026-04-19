'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import QaStatePanel from '../../components/QaStatePanel';

interface TopAgentData {
  agentId: string;
  nama: string;
  batch: string;
  defects: number;
  score: number;
  hasCritical: boolean;
}

interface TopAgentsTableProps {
  agents: TopAgentData[];
  serviceType?: string;
  selectedYear?: number;
}

export default function TopAgentsTable({ agents, serviceType, selectedYear }: TopAgentsTableProps) {
  const router = useRouter();

  const rankingHref = `/qa-analyzer/ranking${
    serviceType || selectedYear
      ? `?${new URLSearchParams({
          ...(serviceType ? { service: serviceType } : {}),
          ...(selectedYear ? { year: String(selectedYear) } : {}),
        }).toString()}`
      : ''
  }`;

  if (!agents || agents.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <QaStatePanel
          type="empty"
          compact
          title="Data agen dengan temuan belum tersedia"
          description="Tabel akan otomatis terisi saat data penilaian tersedia."
          className="max-w-sm"
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden bg-card rounded-xl border border-border shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-border bg-muted/20">
            <th scope="col" className="px-6 py-3 text-xs font-semibold text-muted-foreground">Rank</th>
            <th scope="col" className="px-6 py-3 text-xs font-semibold text-muted-foreground">Agen</th>
            <th scope="col" className="px-6 py-3 text-xs font-semibold text-muted-foreground text-center">Temuan</th>
            <th scope="col" className="px-6 py-3 text-xs font-semibold text-muted-foreground text-center">Skor QA</th>
            <th scope="col" className="px-6 py-3 text-xs font-semibold text-muted-foreground text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {agents.map((agent, index) => (
            <motion.tr 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              key={agent.agentId} 
              className="group hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => router.push(`/qa-analyzer/agents/${agent.agentId}`)}
            >
              <td className="px-6 py-4">
                <span className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                  #{String(index + 1).padStart(2, '0')}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{agent.nama}</span>
                    {agent.hasCritical && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-red-500/20 bg-red-50 text-red-600 text-[10px] font-semibold uppercase">
                        <AlertCircle className="w-3 h-3" /> Fatal
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{agent.batch}</span>
                </div>
              </td>
              <td className="px-6 py-4 text-center">
                <span className="text-sm font-bold text-red-500">
                  {agent.defects}
                </span>
              </td>
              <td className="px-6 py-4 text-center">
                <div className="inline-flex flex-col items-center w-full max-w-[80px]">
                   <span className={`text-sm font-bold ${
                    agent.score >= 90 ? 'text-green-600' :
                    agent.score >= 80 ? 'text-amber-600' :
                    'text-red-600'
                  }`}>
                    {agent.score.toFixed(1)}%
                  </span>
                  <div className="w-full h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        agent.score >= 90 ? 'bg-green-500' :
                        agent.score >= 80 ? 'bg-amber-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${Math.max(10, agent.score)}%` }}
                    />
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-right">
                <button className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted text-muted-foreground transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
      
      <div className="p-3 border-t border-border bg-muted/10 flex justify-end">
        <Link
          href={rankingHref}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
        >
          Lihat Semua Ranking
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
