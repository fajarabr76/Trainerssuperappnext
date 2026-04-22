'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Activity, Clock, Target, Users } from 'lucide-react';
import { deleteActivityAction } from './activities/actions';

export function DashboardActivityClient({ 
  initialRecentLogs,
  role
}: { 
  initialRecentLogs: Array<{ id: string | number; user: string; action: string; time: string; type: string }>;
  role: string;
}) {
  const router = useRouter();
  
  if (role?.toLowerCase() !== 'trainer' && role?.toLowerCase() !== 'admin') {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {initialRecentLogs.length > 0 ? initialRecentLogs.map((log) => (
        <div key={log.id} className="flex items-center justify-between p-4 rounded-2xl bg-background/50 border border-border/30 hover:border-primary/30 transition-all group relative">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${
              log.type === 'login' ? 'bg-blue-500/10 text-blue-500' :
              log.type === 'edit' ? 'bg-purple-500/10 text-purple-500' :
              log.type === 'add' ? 'bg-emerald-500/10 text-emerald-500' :
              'bg-orange-500/10 text-orange-500'
            }`}>
              {log.type === 'login' ? <Users className="w-5 h-5" /> :
              log.type === 'edit' ? <Activity className="w-5 h-5" /> :
              log.type === 'add' ? <Target className="w-5 h-5" /> :
              <Clock className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">{log.user}</div>
              <div className="text-xs text-foreground/50 font-light mt-0.5">
                {log.action}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-[10px] font-mono text-muted-foreground">{log.time}</div>
            {(role?.toLowerCase() === 'trainer' || role?.toLowerCase() === 'admin') && (
              <button
                onClick={async () => {
                  if (confirm('Hapus log aktivitas ini?')) {
                    try {
                      await deleteActivityAction(log.id.toString());
                      router.refresh();
                    } catch (err: unknown) {
                      console.error(err);
                      alert('Gagal menghapus log');
                    }
                  }
                }}
                className="p-2 text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )) : (
        <div className="col-span-full py-8 text-center text-foreground/50 text-sm border border-dashed border-border/40 rounded-2xl bg-background/30">
          Belum ada aktivitas terbaru.
        </div>
      )}
    </div>
  );
}