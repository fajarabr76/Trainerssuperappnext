'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Search, Inbox, Send, Trash2, Plus, Clock } from 'lucide-react';
import { PdktMailboxItem } from '../types';

interface MailboxSidebarProps {
  items: PdktMailboxItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export const MailboxSidebar: React.FC<MailboxSidebarProps> = ({
  items,
  selectedId,
  onSelect,
  onNew
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'replied'>('open');

  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.sender_name.toLowerCase().includes(search.toLowerCase()) || 
      item.subject.toLowerCase().includes(search.toLowerCase());
    
    const matchesFilter = filter === 'all' || item.status === filter;
    
    return matchesSearch && matchesFilter;
  });

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    
    if (isToday) {
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="w-full md:w-80 border-r border-border/50 flex flex-col h-full bg-background shrink-0">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-border/50 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
            <Inbox className="w-4 h-4 text-module-pdkt" />
            Mailbox
          </h2>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onNew}
            className="w-8 h-8 rounded-full bg-module-pdkt text-white flex items-center justify-center shadow-lg shadow-module-pdkt/20 transition-all hover:bg-module-pdkt/90"
          >
            <Plus className="w-4 h-4" />
          </motion.button>
        </div>
        
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 group-focus-within:text-module-pdkt transition-colors" />
          <input 
            type="text" 
            placeholder="Cari email..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-foreground/5 border-none rounded-xl py-2 pl-9 pr-4 text-xs focus:ring-1 focus:ring-module-pdkt/30 outline-none transition-all placeholder:text-muted-foreground/30"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex p-1 bg-foreground/5 rounded-xl">
          {[
            { id: 'all', label: 'Semua' },
            { id: 'open', label: 'Belum Dibalas' },
            { id: 'replied', label: 'Terbalas' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${
                filter === tab.id 
                  ? 'bg-background text-module-pdkt shadow-sm ring-1 ring-black/5' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Email List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <Mail className="w-10 h-10 text-muted-foreground/20 mb-3" />
            <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-loose">
              {search || filter !== 'all' ? 'Hasil Tidak Ditemukan' : 'Kotak Masuk Kosong'}
            </p>
            {!(search || filter !== 'all') && (
              <button 
                onClick={onNew}
                className="mt-4 text-[10px] font-black text-module-pdkt uppercase tracking-widest hover:underline"
              >
                Buat Email Pertama
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={`w-full text-left p-4 transition-all relative flex gap-3 ${
                  selectedId === item.id 
                    ? 'bg-module-pdkt/[0.03] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-module-pdkt' 
                    : 'hover:bg-foreground/[0.02]'
                }`}
              >
                <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  selectedId === item.id ? 'bg-module-pdkt text-white shadow-md shadow-module-pdkt/20' : 'bg-foreground/5 text-muted-foreground'
                }`}>
                  {getInitials(item.sender_name)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`text-xs truncate ${item.status === 'open' ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'}`}>
                      {item.sender_name}
                    </span>
                    <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                      {formatTime(item.last_activity_at)}
                    </span>
                  </div>
                  
                  <div className={`text-[11px] truncate mb-0.5 ${item.status === 'open' ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'}`}>
                    {item.subject || '(Tanpa Subjek)'}
                  </div>
                  
                  <div className="text-[10px] text-muted-foreground line-clamp-1 leading-relaxed opacity-70">
                    {item.snippet}
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    {item.status === 'open' ? (
                      <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-module-pdkt bg-module-pdkt/10 px-1.5 py-0.5 rounded-full">
                        <Clock className="w-2 h-2" /> Menunggu Balasan
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                        <Inbox className="w-2 h-2" /> Terbalas
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="p-3 border-t border-border/50 bg-foreground/[0.02] flex items-center justify-around">
        <button className="p-2 text-module-pdkt hover:bg-module-pdkt/10 rounded-xl transition-all" title="Inbox">
          <Inbox className="w-4 h-4" />
        </button>
        <button className="p-2 text-muted-foreground/40 hover:bg-foreground/5 rounded-xl transition-all" title="Sent (History)">
          <Send className="w-4 h-4" />
        </button>
        <button className="p-2 text-muted-foreground/40 hover:bg-foreground/5 rounded-xl transition-all" title="Trash">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
