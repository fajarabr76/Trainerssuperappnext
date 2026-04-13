'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ChevronRight, User } from 'lucide-react';
import { motion } from 'motion/react';

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
      <div className="h-64 flex flex-col items-center justify-center text-muted-foreground text-sm italic">
        <div className="w-12 h-12 rounded-full bg-foreground/5 flex items-center justify-center mb-3">
          <User className="w-6 h-6 opacity-20" />
        </div>
        Tidak ada data agen dengan temuan.
      </div>
    );
  }

  return (
    <div className="overflow-hidden bg-card/50 backdrop-blur-sm rounded-xl border border-border/50">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-border/50">
            <th scope="col" className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Rank</th>
            <th scope="col" className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Agen</th>
            <th scope="col" className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Temuan</th>
            <th scope="col" className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Skor QA</th>
            <th scope="col" className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {agents.map((agent, index) => (
            <motion.tr 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              key={agent.agentId} 
              className="group hover:bg-primary/[0.02] transition-colors cursor-pointer"
              onClick={() => router.push(`/qa-analyzer/agents/${agent.agentId}`)}
            >
              <td className="px-6 py-4">
                <span className="text-xs font-black text-muted-foreground group-hover:text-primary/40 transition-colors">
                  #{String(index + 1).padStart(2, '0')}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{agent.nama}</span>
                    {agent.hasCritical && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-500 text-[9px] font-black uppercase tracking-tighter">
                        <AlertCircle className="w-2.5 h-2.5" /> Fatal
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">{agent.batch}</span>
                </div>
              </td>
              <td className="px-6 py-4 text-center">
                <span className="text-sm font-black text-rose-500/80 tabular-nums">
                  {agent.defects}
                </span>
              </td>
              <td className="px-6 py-4 text-center">
                <div className="inline-flex flex-col items-center">
                   <span className={`text-sm font-black tabular-nums ${
                    agent.score >= 90 ? 'text-emerald-500' :
                    agent.score >= 80 ? 'text-amber-500' :
                    'text-rose-500'
                  }`}>
                    {agent.score.toFixed(1)}%
                  </span>
                  <div className="w-12 h-1 bg-foreground/5 rounded-full mt-1 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        agent.score >= 90 ? 'bg-emerald-500' :
                        agent.score >= 80 ? 'bg-amber-500' :
                        'bg-rose-500'
                      }`}
                      style={{ width: `${Math.max(10, agent.score)}%` }}
                    />
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-right">
                <button className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-foreground/5 text-muted-foreground group-hover:bg-primary group-hover:text-white transition-all duration-300">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
      
      <div className="p-3 border-t border-border/30 bg-white/30 dark:bg-black/10 flex justify-end">
        <Link
          href={rankingHref}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-primary hover:bg-primary/10 transition-all duration-200"
        >
          Lihat Semua Ranking
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
