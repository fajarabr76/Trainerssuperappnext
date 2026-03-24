'use client';

import { ProfilerYear, ProfilerFolder } from '../services/profilerService';
import { 
  Plus, ChevronRight, ChevronDown, Folder, 
  FolderOpen, Pencil, Trash2, Copy, MoreVertical 
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface YearSidebarProps {
  years: ProfilerYear[];
  folders: ProfilerFolder[];
  selectedYearId: string | null;
  selectedFolderId: string | null;
  onSelectYear: (id: string) => void;
  onSelectFolder: (id: string) => void;
  onAddYear: () => void;
  onAddFolder: (yearId: string, parentId?: string) => void;
  onRenameFolder: (folder: ProfilerFolder) => void;
  onDeleteFolder: (folder: ProfilerFolder) => void;
  onDuplicateFolder: (folder: ProfilerFolder) => void;
  counts: Record<string, number>;
}

export default function YearSidebar({
  years,
  folders,
  selectedYearId,
  selectedFolderId,
  onSelectYear,
  onSelectFolder,
  onAddYear,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
  onDuplicateFolder,
  counts
}: YearSidebarProps) {
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // Auto-expand current year
  useEffect(() => {
    if (years.length > 0) {
      const currentYear = new Date().getFullYear();
      const yearToExpand = years.find(y => y.year === currentYear);
      if (yearToExpand) {
        setExpandedYears(prev => ({ ...prev, [yearToExpand.id]: true }));
      }
    }
  }, [years]);

  const toggleYear = (id: string) => {
    setExpandedYears(prev => ({ ...prev, [id]: !prev[id] }));
    onSelectYear(id);
  };

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const rootFolders = (yearId: string) => 
    folders.filter(f => f.year_id === yearId && !f.parent_id);
  
  const subFolders = (parentId: string) => 
    folders.filter(f => f.parent_id === parentId);

  return (
    <div className="w-64 border border-border/40 rounded-2xl bg-card/60 backdrop-blur-xl flex flex-col h-full overflow-hidden relative z-20 shadow-sm shrink-0">
      <div className="p-4 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-foreground/60">Hierarki Data</h2>
        </div>
        <button 
          onClick={onAddYear}
          className="w-8 h-8 flex items-center justify-center bg-accent/50 hover:bg-primary hover:text-primary-foreground rounded-xl text-muted-foreground transition-all duration-300 border border-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          title="Tambah Tahun"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
        {years.length === 0 && (
          <div className="p-4 text-center text-xs text-muted-foreground italic">
            Belum ada data tahun.
          </div>
        )}

        {years.map(year => (
          <div key={year.id} className="space-y-1">
            <button
              onClick={() => toggleYear(year.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-sm group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
                selectedYearId === year.id 
                  ? 'bg-primary/10 text-primary font-bold border border-primary/20' 
                  : 'hover:bg-accent/50 text-foreground/60 border border-transparent'
              }`}
            >
              <div className={`transition-transform duration-300 ${expandedYears[year.id] ? 'rotate-90' : ''}`}>
                <ChevronRight size={14} />
              </div>
              <span className="flex-1 text-left tracking-tight">{year.label}</span>
            </button>

            <AnimatePresence>
              {expandedYears[year.id] && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="ml-4 space-y-1 overflow-hidden"
                >
                  {rootFolders(year.id).map(folder => (
                    <div key={folder.id} className="space-y-1">
                      <div className="group flex items-center gap-1">
                        <button
                          onClick={() => {
                            onSelectFolder(folder.id);
                            if (subFolders(folder.id).length > 0) toggleFolder(folder.id);
                          }}
                          className={`flex-1 flex items-center gap-3 p-2.5 rounded-xl text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
                            selectedFolderId === folder.id
                              ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                              : 'hover:bg-accent/50 text-foreground/50'
                          }`}
                        >
                          <div className="flex-shrink-0">
                            {subFolders(folder.id).length > 0 ? (
                              <div className={`transition-transform duration-300 ${expandedFolders[folder.id] ? 'rotate-90' : ''}`}>
                                <ChevronRight size={12} />
                              </div>
                            ) : (
                              <Folder size={12} />
                            )}
                          </div>
                          <span className="flex-1 text-left truncate tracking-tight">{folder.name}</span>
                          <span className={`text-[10px] font-mono ${selectedFolderId === folder.id ? 'opacity-100' : 'opacity-40'}`}>
                            {counts[folder.name] || 0}
                          </span>
                        </button>
                        
                        <div className="hidden group-hover:flex items-center gap-0.5 pr-1">
                          <button onClick={() => onAddFolder(year.id, folder.id)} className="p-1 hover:bg-accent rounded text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background" title="Tambah Sub-folder"><Plus size={12} /></button>
                          <button onClick={() => onDuplicateFolder(folder)} className="p-1 hover:bg-accent rounded text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background" title="Duplikat ke Tahun Lain"><Copy size={12} /></button>
                          <button onClick={() => onRenameFolder(folder)} className="p-1 hover:bg-accent rounded text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background" title="Rename"><Pencil size={12} /></button>
                          <button onClick={() => onDeleteFolder(folder)} className="p-1 hover:bg-accent/50 text-destructive rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-1 focus-visible:ring-offset-background" title="Hapus"><Trash2 size={12} /></button>
                        </div>
                      </div>

                      {expandedFolders[folder.id] && (
                        <div className="ml-4 space-y-1 border-l border-border/40 pl-2">
                          {subFolders(folder.id).map(sub => (
                            <div key={sub.id} className="group flex items-center gap-1">
                                <button
                                  onClick={() => onSelectFolder(sub.id)}
                                  className={`flex-1 flex items-center gap-2 p-1.5 rounded-md text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
                                    selectedFolderId === sub.id
                                      ? 'bg-primary/20 text-primary font-medium'
                                      : 'hover:bg-accent text-muted-foreground'
                                  }`}
                                >
                                  <Folder size={12} />
                                  <span className="flex-1 text-left truncate">{sub.name}</span>
                                  <span className="text-[10px] opacity-70">({counts[sub.name] || 0})</span>
                                </button>
                                <div className="hidden group-hover:flex items-center gap-0.5 pr-1">
                                  <button onClick={() => onRenameFolder(sub)} className="p-1 hover:bg-accent rounded text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title="Rename"><Pencil size={12} /></button>
                                  <button onClick={() => onDeleteFolder(sub)} className="p-1 hover:bg-accent/50 text-destructive rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive" title="Hapus"><Trash2 size={12} /></button>
                                </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  <button
                    onClick={() => onAddFolder(year.id)}
                    className="w-full flex items-center gap-2 p-1.5 rounded-md text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-all border border-dashed border-border/40 mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                  >
                    <Plus size={12} />
                    <span>Folder baru</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
