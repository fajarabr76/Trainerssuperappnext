import React from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ChevronRight } from 'lucide-react';

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
}

export default function TopAgentsTable({ agents }: TopAgentsTableProps) {
  const router = useRouter();

  if (!agents || agents.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-foreground/40 text-sm">
        Tidak ada data agen dengan temuan.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-foreground/60 uppercase bg-foreground/5">
          <tr>
            <th scope="col" className="px-4 py-3 rounded-l-lg">Rank</th>
            <th scope="col" className="px-4 py-3">Nama Agen</th>
            <th scope="col" className="px-4 py-3">Tim/Batch</th>
            <th scope="col" className="px-4 py-3 text-center">Jumlah Temuan</th>
            <th scope="col" className="px-4 py-3 text-center">Skor QA</th>
            <th scope="col" className="px-4 py-3 rounded-r-lg">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent, index) => (
            <tr 
              key={agent.agentId} 
              className="border-b border-border hover:bg-foreground/5 transition-colors cursor-pointer"
              onClick={() => router.push(`/qa-analyzer/agents/${agent.agentId}`)}
            >
              <td className="px-4 py-4 font-medium text-foreground">
                #{index + 1}
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{agent.nama}</span>
                  {agent.hasCritical && (
                    <span title="Critical Error Detected">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-4 text-foreground/60">
                {agent.batch}
              </td>
              <td className="px-4 py-4 text-center font-semibold text-red-500">
                {agent.defects}
              </td>
              <td className="px-4 py-4 text-center">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  agent.score >= 90 ? 'bg-green-500/10 text-green-500' :
                  agent.score >= 80 ? 'bg-yellow-500/10 text-yellow-500' :
                  'bg-red-500/10 text-red-500'
                }`}>
                  {agent.score.toFixed(1)}
                </span>
              </td>
              <td className="px-4 py-4">
                <button className="text-primary hover:text-primary/80 flex items-center gap-1 text-xs font-medium">
                  Detail <ChevronRight className="w-3 h-3" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
