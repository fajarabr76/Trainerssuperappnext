'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

import {
  X, Check, ChevronRight,
  FolderOpen, User as UserIcon, CalendarDays, Plus, Trash2,
  Pencil, Upload, Download, FileSpreadsheet,
  Menu, Sun, Moon, Loader2
} from 'lucide-react';

import { useTheme } from 'next-themes';
import type ExcelJS from 'exceljs';
import { createClient } from '@/app/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import { Profile } from '@/app/types/auth';
import { 
  calculateQAScoreFromTemuan, 
  scoreColor, 
  scoreLabel, 
  scoreBg,
  NILAI_LABELS,
  Agent,
  unwrapIndicator,
} from '../lib/qa-types';
import type { QAIndicator, QAPeriod, QATemuan, ServiceType, ServiceWeight } from '../lib/qa-types';
import { TIM_TO_DEFAULT_SERVICE, SERVICE_LABELS, DEFAULT_SERVICE_WEIGHTS } from '../lib/qa-types';
import { 
  createTemuanBatchAction, 
  updateTemuanAction, 
  deleteTemuanAction,
  getAgentsByFolderAction,
  createPerfectScoreSessionAction
} from '../actions';
import QaStatePanel from '../components/QaStatePanel';

const supabase = createClient();

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
type Step = 'folder' | 'agent' | 'period' | 'list';

const NILAI_OPTIONS = [
  { v: 0, sub: 'Sangat Tidak Sesuai', active: 'bg-red-500 text-white border-transparent',    inactive: 'bg-gray-50 dark:bg-white/[0.04] border-gray-200 dark:border-white/10 text-gray-400 dark:text-gray-500' },
  { v: 1, sub: 'Tidak Sesuai',        active: 'bg-orange-500 text-white border-transparent', inactive: 'bg-gray-50 dark:bg-white/[0.04] border-gray-200 dark:border-white/10 text-gray-400 dark:text-gray-500' },
  { v: 2, sub: 'Perlu Perbaikan',     active: 'bg-amber-500 text-white border-transparent',  inactive: 'bg-gray-50 dark:bg-white/[0.04] border-gray-200 dark:border-white/10 text-gray-400 dark:text-gray-500' },
  { v: 3, sub: 'Sesuai',              active: 'bg-green-500 text-white border-transparent',  inactive: 'bg-gray-50 dark:bg-white/[0.04] border-gray-200 dark:border-white/10 text-gray-400 dark:text-gray-500' },
];

const NILAI_BADGE: Record<number, string> = {
  0: 'bg-red-500', 1: 'bg-orange-500', 2: 'bg-amber-500', 3: 'bg-green-500',
};

interface ParamEntry {
  uid: string;
  indicator_id: string;
  showDropdown: boolean;
  nilai: number;
  ketidaksesuaian: string;
  sebaiknya: string;
}

interface ImportRow {
  rowNum: number;
  no_tiket: string;
  paramName: string;
  indicator_id: string | null;
  nilai: number | null;
  ketidaksesuaian: string;
  sebaiknya: string;
  errors: string[];
}

function isMissingPhantomColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  return error.code === '42703'
    || error.code === 'PGRST204'
    || message.includes('is_phantom_padding')
    || message.includes('schema cache');
}

function newEntry(): ParamEntry {
  return { uid: Math.random().toString(36).slice(2), indicator_id: '', showDropdown: false, nilai: 3, ketidaksesuaian: '', sebaiknya: '' };
}

// ── Dropdown fix: portal-style dengan posisi fixed ────────────────────────────
function IndicatorDropdown({ value, indicators, open, onToggle, onSelect, scoringMode = 'weighted' }: {
  value: string; indicators: QAIndicator[]; open: boolean;
  onToggle: () => void; onSelect: (id: string) => void;
  scoringMode?: string;
}) {
  const selected   = indicators.find(i => i.id === value);
  const nc         = indicators.filter(i => i.category === 'non_critical');
  const cr         = indicators.filter(i => i.category === 'critical');
  const btnRef     = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; openUp: boolean }>({
    top: 0, left: 0, width: 0, openUp: false,
  });

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect      = btnRef.current.getBoundingClientRect();
    const dropH     = 288; 
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const openUp    = spaceBelow < dropH && rect.top > dropH;
    setPos({
      top:    openUp ? rect.top - dropH - 4 : rect.bottom + 4,
      left:   rect.left,
      width:  rect.width,
      openUp,
    });
  }, [open]);

  return (
    <div className="relative">
      <button ref={btnRef} type="button" onClick={onToggle}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm text-left transition-all ${
          open ? 'border-primary ring-2 ring-primary/20' : 'border-border'
        } bg-card text-foreground`}>
        <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
          {selected ? `${selected.name} (${Math.round(selected.bobot * 100)}%)` : '— Pilih parameter —'}
        </span>
        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={onToggle} />
          <div
            className="fixed z-40 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: 288, overflowY: 'auto' }}
          >
            {scoringMode === 'no_category' ? (
              indicators.map(ind => (
                <button key={ind.id} type="button" onClick={() => onSelect(ind.id)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors border-b border-border ${
                    value === ind.id ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-foreground/5'
                  }`}>
                  <span>{ind.name}</span>
                  <span className={`text-[10px] font-bold ml-2 flex-shrink-0 ${value === ind.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{Math.round(ind.bobot * 100)}%</span>
                </button>
              ))
            ) : (
              <>
                <div className="px-3 py-1.5 bg-blue-500/10 border-b border-border sticky top-0">
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Non-Critical Error</p>
                </div>
                {nc.map(ind => (
                  <button key={ind.id} type="button" onClick={() => onSelect(ind.id)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors border-b border-border ${
                      value === ind.id ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-foreground/5'
                    }`}>
                    <span>{ind.name}</span>
                    <span className={`text-[10px] font-bold ml-2 flex-shrink-0 ${value === ind.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{Math.round(ind.bobot * 100)}%</span>
                  </button>
                ))}
                <div className="px-3 py-1.5 bg-red-500/10 border-t border-b border-border sticky top-[33px]">
                  <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Critical Error</p>
                </div>
                {cr.map(ind => (
                  <button key={ind.id} type="button" onClick={() => onSelect(ind.id)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors border-b border-border ${
                      value === ind.id ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-foreground/5'
                    }`}>
                    <span>{ind.name}</span>
                    <span className={`text-[10px] font-bold ml-2 flex-shrink-0 ${value === ind.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{Math.round(ind.bobot * 100)}%</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Excel template generator ───────────────────────────────────────────────────
async function generateTemplate(indicators: QAIndicator[], agentName: string, periodLabel: string, activeWeight: ServiceWeight) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SIDAK';
  wb.created = new Date();

  const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
  const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  const NC_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdbeafe' } };
  const CR_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFfee2e2' } };

  const wsParams = wb.addWorksheet('_Params');
  wsParams.state = 'veryHidden';
  indicators.forEach((ind, i) => { wsParams.getCell(`A${i + 1}`).value = ind.name; });

  const ws = wb.addWorksheet('Input Temuan');
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.columns = [
    { key: 'tiket',  header: 'No. Tiket',       width: 18 },
    { key: 'param',  header: 'Parameter',         width: 48 },
    { key: 'nilai',  header: 'Nilai (0-3)',        width: 13 },
    { key: 'ktdk',   header: 'Ketidaksesuaian',   width: 42 },
    { key: 'sbknya', header: 'Sebaiknya',          width: 42 },
  ];
  const headerRow = ws.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill = HEADER_FILL; cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF6D28D9' } } };
  });
  headerRow.height = 22;

  const examples = [];
  if (indicators.length > 0) examples.push({ tiket: 'L2503001', param: indicators[0].name, nilai: 2, ktdk: 'Contoh ketidaksesuaian', sbknya: 'Contoh perbaikan' });
  if (indicators.length > 1) examples.push({ tiket: 'L2503001', param: indicators[1].name, nilai: 1, ktdk: '', sbknya: '' });
  if (indicators.length > 2) examples.push({ tiket: 'L2503002', param: indicators[2].name, nilai: 0, ktdk: '', sbknya: '' });
  
  examples.forEach(ex => {
    const row = ws.addRow(ex);
    row.getCell('param').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
    row.getCell('nilai').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
  });

  const paramCount = indicators.length;
  for (let r = 2; r <= 101; r++) {
    ws.getCell(`B${r}`).dataValidation = {
      type: 'list', allowBlank: true, formulae: [`_Params!$A$1:$A$${paramCount}`],
      showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Parameter tidak valid',
      error: 'Pilih parameter dari dropdown yang tersedia',
    };
    ws.getCell(`C${r}`).dataValidation = {
      type: 'whole', operator: 'between', allowBlank: true, formulae: [0, 3],
      showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Nilai tidak valid',
      error: 'Isi dengan angka 0, 1, 2, atau 3',
    };
  }

  const wsRef = wb.addWorksheet('Referensi Parameter');
  wsRef.columns = [
    { header: 'Parameter', width: 48 }, { header: 'Kategori', width: 22 },
    { header: 'Bobot (%)', width: 13 }, { header: 'Catatan',  width: 45 },
  ];
  wsRef.getRow(1).eachCell(cell => {
    cell.fill = HEADER_FILL; cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  wsRef.getRow(1).height = 22;
  indicators.forEach(ind => {
    const isCr = ind.category === 'critical';
    let weightDesc = 'Kontribusi 50% ke skor akhir';
    if (activeWeight.scoring_mode === 'weighted') {
      weightDesc = isCr ? `Kontribusi ${Math.round(activeWeight.critical_weight * 100)}% ke skor` : `Kontribusi ${Math.round(activeWeight.non_critical_weight * 100)}% ke skor`;
    } else if (activeWeight.scoring_mode === 'flat') {
      weightDesc = 'Skor dihitung flat sesuai bobot parameter';
    } else {
      weightDesc = 'BKO/Satu kategori (No weight profiling)';
    }

    const row = wsRef.addRow([ind.name, isCr ? 'Critical Error' : 'Non-Critical Error', Math.round(ind.bobot * 100), weightDesc]);
    row.getCell(1).fill = isCr ? CR_FILL : NC_FILL;
    row.getCell(2).fill = isCr ? CR_FILL : NC_FILL;
    row.getCell(2).font = { bold: true, color: { argb: isCr ? 'FFb91c1c' : 'FF1d4ed8' } };
  });

  const wsNilai = wb.addWorksheet('Referensi Nilai');
  wsNilai.columns = [{ header: 'Nilai', width: 9 }, { header: 'Label', width: 24 }, { header: 'Keterangan', width: 58 }];
  wsNilai.getRow(1).eachCell(cell => {
    cell.fill = HEADER_FILL; cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  [
    [3, 'Sesuai',              'Agent sudah sesuai standar — tidak perlu dicatat sebagai temuan'],
    [2, 'Perlu Perbaikan',     'Ketidaksesuaian ringan yang perlu diperbaiki'],
    [1, 'Tidak Sesuai',        'Jelas tidak sesuai dengan standar layanan'],
    [0, 'Sangat Tidak Sesuai', 'Pelanggaran serius terhadap standar layanan'],
  ].forEach(([v, label, ket]) => {
    const row = wsNilai.addRow([v, label, ket]);
    const colors: Record<number, string> = { 3: 'FFdcfce7', 2: 'FFfef9c3', 1: 'FFffedd5', 0: 'FFfee2e2' };
    row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors[v as number] } }; });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `Template_SIDAK_${agentName.replace(/\s/g, '_')}_${periodLabel}.xlsx`;
  a.click(); URL.revokeObjectURL(url);
}

// ── Parse uploaded Excel ───────────────────────────────────────────────────────
async function parseExcel(file: File, indicators: QAIndicator[]): Promise<ImportRow[]> {
  const XLSX = await import('xlsx');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb   = XLSX.read(data, { type: 'array' });
        const sheetName = wb.SheetNames.find((n: string) => n === 'Input Temuan') ?? wb.SheetNames[0];
        const ws   = wb.Sheets[sheetName];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const paramMap = new Map(indicators.map(i => [i.name.toLowerCase().trim(), i]));
        const result: ImportRow[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every((c: unknown) => c === '' || c === null || c === undefined)) continue;
          const no_tiket       = String(row[0] ?? '').trim();
          const paramName      = String(row[1] ?? '').trim();
          const nilaiRaw       = row[2];
          const ketidaksesuaian = String(row[3] ?? '').trim();
          const sebaiknya      = String(row[4] ?? '').trim();
          const errors: string[] = [];
          let indicator_id: string | null = null;
          let nilai: number | null = null;
          const matched = paramMap.get(paramName.toLowerCase());
          if (!paramName) errors.push('Parameter kosong');
          else if (!matched) errors.push(`Parameter "${paramName}" tidak dikenali`);
          else indicator_id = matched.id;
          const nilaiNum = Number(nilaiRaw);
          if (nilaiRaw === '' || nilaiRaw === null || nilaiRaw === undefined) {
            nilai = 3;
          } else if (isNaN(nilaiNum) || ![0,1,2,3].includes(nilaiNum)) {
            errors.push(`Nilai "${nilaiRaw}" tidak valid (harus 0-3)`);
          } else { nilai = nilaiNum; }
          result.push({ rowNum: i + 1, no_tiket, paramName, indicator_id, nilai, ketidaksesuaian, sebaiknya, errors });
        }
        resolve(result);
      } catch (err: unknown) { reject(new Error('Gagal membaca file: ' + (err as Error).message)); }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsArrayBuffer(file);
  });
}

interface QaInputClientProps {
  user: User | null;
  role: string;
  profile: Profile | null;
  initialFolders: string[];
  initialPeriods: QAPeriod[];
  initialAgents?: Agent[];
  initialAgent?: Agent;
  initialIndicators?: QAIndicator[];
  initialTemuan?: QATemuan[];
  initialStep?: Step;
  initialFolder?: string;
  initialService?: ServiceType;
  initialTeam?: string;
  initialPeriod?: QAPeriod | null;
  initialWeights?: Record<ServiceType, ServiceWeight>;
}

export default function QaInputClient({ 
  role, 
  initialFolders, initialPeriods, 
  initialAgents, initialAgent, initialIndicators, initialTemuan,
  initialStep = 'folder',
  initialFolder,
  initialService,
  initialTeam,
  initialPeriod,
  initialWeights,
}: QaInputClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const _pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const [step, setStep]         = useState<Step>(initialStep);
  const [folders, _setFolders]   = useState<string[]>(initialFolders);
  const [agents, setAgents]     = useState<Agent[]>(initialAgents ?? []);
  const [periods, _setPeriods]   = useState<QAPeriod[]>(initialPeriods);
  const [indicators, setIndicators] = useState<QAIndicator[]>(initialIndicators ?? []);
  const [temuan, setTemuan]     = useState<QATemuan[]>(initialTemuan ?? []);

  const [selectedFolder, setSelectedFolder] = useState<string | null>(initialFolder ?? null);
  const [selectedAgent, setSelectedAgent]   = useState<Agent | null>(initialAgent ?? null);
  const [selectedPeriod, setSelectedPeriod] = useState<QAPeriod | null>(initialPeriod ?? null);
  const [selectedService, setSelectedService] = useState<ServiceType>(initialService ?? 'call');
  const [selectedTeam, setSelectedTeam] = useState<string>(initialTeam ?? '');
  const [weights, _setWeights] = useState<Record<ServiceType, ServiceWeight>>(initialWeights ?? DEFAULT_SERVICE_WEIGHTS);

  const activeWeight = weights[selectedService];

  const [showForm, setShowForm]   = useState(false);
  const [noTiket, setNoTiket]     = useState('');
  const [entries, setEntries]     = useState<ParamEntry[]>([newEntry()]);

  const [editingId, setEditingId]             = useState<string | null>(null);
  const [editNilai, setEditNilai]             = useState(3);
  const [editKetidaksesuaian, setEditKetidaksesuaian] = useState('');
  const [editSebaiknya, setEditSebaiknya]     = useState('');

  const [showImport, setShowImport]   = useState(false);
  const [importTab, setImportTab]     = useState<'download' | 'upload'>('download');
  const [importRows, setImportRows]   = useState<ImportRow[]>([]);
  const [importFile, setImportFile]   = useState<File | null>(null);
  const [importing, setImporting]     = useState(false);
  const [parsing, setParsing]         = useState(false);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);

  const [saving, setSaving]         = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [_isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const _handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/?auth=login');
    router.refresh();
  };

  useEffect(() => {
    const ap = searchParams.get('agentId');
    if (ap && agents.length > 0 && !selectedAgent) {
      const agent = agents.find(a => a.id === ap);
      if (agent) setSelectedAgent(agent);
    }
  }, [searchParams, agents, selectedAgent]);

  const handleSelectFolder = async (folder: string) => {
    setSelectedFolder(folder); setSelectedAgent(null); setSelectedPeriod(null); setTemuan([]); setLoading(true);
    try {
      const agentList = await getAgentsByFolderAction(folder);
      setAgents(agentList);
      setStep('agent');
    } catch (err: unknown) { setErrorMsg((err as Error).message); } finally { setLoading(false); }
  };


  const handleSelectAgent = async (agent: Agent) => {
    setSelectedAgent(agent); setSelectedPeriod(null); setTemuan([]);
    
    // Default service for the team
    let defaultService: ServiceType = 'call';
    const normalizedTim = agent.tim?.toLowerCase()?.trim() || '';
    if (normalizedTim.includes('mix')) {
      defaultService = 'cso';
    } else if (normalizedTim.includes('chat')) {
      defaultService = 'chat';
    } else if (normalizedTim.includes('email')) {
      defaultService = 'email';
    } else if (normalizedTim.includes('bko')) {
      defaultService = 'bko';
    } else if (normalizedTim.includes('slik')) {
      defaultService = 'slik';
    }
    setSelectedService(defaultService);
    setSelectedTeam(agent.tim || '');
    
    const { data: inds } = await supabase.from('qa_indicators').select('*').eq('service_type', defaultService).order('category').order('bobot', { ascending: false });
    setIndicators(inds || []);
    setStep('period');
  };

  const handleServiceChange = async (newService: ServiceType) => {
    setSelectedService(newService);
    const { data: inds } = await supabase.from('qa_indicators').select('*').eq('service_type', newService).order('category').order('bobot', { ascending: false });
    setIndicators(inds || []);
    setEntries([newEntry()]); // reset form to avoid invalid indicator ids
    
    // Bug 2 Fix: If a period is already selected, re-fetch temuan for the new service to ensure accurate score calculation
    if (selectedAgent && selectedPeriod) {
      setLoading(true);
      try {
        const query = supabase
          .from('qa_temuan')
          .select('*, qa_indicators(id, name, category, bobot, has_na, service_type), qa_periods(id, month, year)')
          .eq('peserta_id', selectedAgent.id)
          .eq('period_id', selectedPeriod.id)
          .eq('service_type', newService);
        let { data: found, error } = await query
          .eq('is_phantom_padding', false)
          .order('created_at', { ascending: false });
        if (error && isMissingPhantomColumnError(error)) {
          const fallback = await query.order('created_at', { ascending: false });
          found = fallback.data;
          error = fallback.error;
        }
        if (error) throw error;
        setTemuan(found || []);
      } catch (err: unknown) { 
        setErrorMsg((err as Error).message); 
      } finally { 
        setLoading(false); 
      }
    }
  };

  const handleSelectPeriod = async (period: QAPeriod) => {
    if (!selectedAgent) return;
    setSelectedPeriod(period); setLoading(true); setErrorMsg(null);
    try { 
      const query = supabase
        .from('qa_temuan')
        .select('*, qa_indicators(id, name, category, bobot, has_na, service_type), qa_periods(id, month, year)')
        .eq('peserta_id', selectedAgent.id)
        .eq('period_id', period.id)
        .eq('service_type', selectedService); // Bug 2 Fix: Only fetch temuan for the relevant service
      let { data: found, error } = await query
        .eq('is_phantom_padding', false)
        .order('created_at', { ascending: false });
      if (error && isMissingPhantomColumnError(error)) {
        const fallback = await query.order('created_at', { ascending: false });
        found = fallback.data;
        error = fallback.error;
      }
      if (error) throw error;
      setTemuan(found || []); 
      setStep('list'); 
    }
    catch (err: unknown) { setErrorMsg((err as Error).message); } finally { setLoading(false); }
  };

  const updateEntry = (uid: string, patch: Partial<ParamEntry>) =>
    setEntries(prev => prev.map(e => e.uid === uid ? { ...e, ...patch } : e));
  const closeAllDropdowns = () =>
    setEntries(prev => prev.map(e => ({ ...e, showDropdown: false })));
  const resetForm = () => { setNoTiket(''); setEntries([newEntry()]); setShowForm(false); setErrorMsg(null); };

  const handleSave = async () => {
    if (!selectedAgent || !selectedPeriod) return;
    if (entries.some(e => !e.indicator_id)) return setErrorMsg('Semua parameter wajib dipilih.');
    if (!noTiket.trim()) {
      const ok = window.confirm('No. Tiket kosong. Setiap temuan tanpa no. tiket dihitung sebagai sesi terpisah dan memengaruhi akurasi skor. Lanjutkan?');
      if (!ok) return;
    }
    setSaving(true); setErrorMsg(null);
    try {
      const temuanList = entries.map(entry => ({
        indicator_id: entry.indicator_id,
        no_tiket: noTiket || undefined,
        nilai: entry.nilai,
        ketidaksesuaian: entry.ketidaksesuaian || undefined,
        sebaiknya: entry.sebaiknya || undefined,
        service_type: selectedService,
      }));

      const created = await createTemuanBatchAction(selectedAgent.id, selectedPeriod.id, temuanList);
      
      setTemuan(prev => [...(created as QATemuan[]).reverse(), ...prev]);
      resetForm();
      setSuccessMsg(`${(created as QATemuan[]).length} temuan berhasil disimpan!`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) { setErrorMsg((err as Error).message); } finally { setSaving(false); }
  };

  const startEdit = (t: QATemuan) => {
    setEditingId(t.id); setEditNilai(t.nilai);
    setEditKetidaksesuaian(t.ketidaksesuaian ?? ''); setEditSebaiknya(t.sebaiknya ?? '');
    setDeletingId(null);
  };
  const cancelEdit = () => setEditingId(null);
  const handleSaveEdit = async (id: string) => {
    setSavingEdit(true); setErrorMsg(null);
    try {
      const updated = await updateTemuanAction(id, { nilai: editNilai, ketidaksesuaian: editKetidaksesuaian || undefined, sebaiknya: editSebaiknya || undefined });
      setTemuan(prev => prev.map(t => t.id === id ? updated : t));
      setEditingId(null);
      setSuccessMsg('Temuan berhasil diperbarui!'); setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) { setErrorMsg((err as Error).message); } finally { setSavingEdit(false); }
  };

  const handleDelete = async (id: string) => {
    if (deletingId !== id) { setDeletingId(id); setEditingId(null); return; }
    try { await deleteTemuanAction(id); setTemuan(prev => prev.filter(t => t.id !== id)); setDeletingId(null); }
    catch (err: unknown) { setErrorMsg((err as Error).message); setDeletingId(null); }
  };

  const handleDownloadTemplate = async () => {
    setGeneratingTemplate(true);
    try {
      await generateTemplate(indicators, selectedAgent?.nama ?? 'Agent', periodLabel, activeWeight);
    } catch (err) {
      console.error(err);
      setErrorMsg('Gagal membuat template Excel.');
    } finally {
      setGeneratingTemplate(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file); setParsing(true); setImportRows([]);
    try { const rows = await parseExcel(file, indicators); setImportRows(rows); setImportTab('upload'); }
    catch (err: unknown) { setErrorMsg((err as Error).message); } finally { setParsing(false); }
  };

  const validImportRows   = importRows.filter(r => r.errors.length === 0);
  const invalidImportRows = importRows.filter(r => r.errors.length > 0);

  const handleImportSave = async () => {
    if (!selectedAgent || !selectedPeriod || validImportRows.length === 0) return;
    setImporting(true); setErrorMsg(null);
    try {
      const temuanList = validImportRows.map(row => ({
        indicator_id: row.indicator_id!,
        no_tiket: row.no_tiket || undefined,
        nilai: row.nilai!,
        ketidaksesuaian: row.ketidaksesuaian || undefined,
        sebaiknya: row.sebaiknya || undefined,
        service_type: selectedService,
      }));

      const created = await createTemuanBatchAction(selectedAgent.id, selectedPeriod.id, temuanList);

      setTemuan(prev => [...(created as QATemuan[]).reverse(), ...prev]);
      setShowImport(false); setImportRows([]); setImportFile(null);
      setSuccessMsg(`${(created as QATemuan[]).length} temuan berhasil diimport!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) { setErrorMsg((err as Error).message); } finally { setImporting(false); }
  };

  const handlePerfectScore = async () => {
    if (!selectedAgent || !selectedPeriod) return;

    setSaving(true); setErrorMsg(null);
    try {
      await createPerfectScoreSessionAction(selectedAgent.id, selectedPeriod.id, selectedService as ServiceType);
      setSuccessMsg('Sesi Tanpa Temuan berhasil ditambahkan (phantom padding 5 sesi).');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const resetToStep = (target: Step) => {
    setErrorMsg(null); setSuccessMsg(null); resetForm(); setDeletingId(null); setEditingId(null);
    if (target === 'folder') { setSelectedFolder(null); setSelectedAgent(null); setSelectedPeriod(null); setTemuan([]); }
    else if (target === 'agent') { setSelectedAgent(null); setSelectedPeriod(null); setTemuan([]); }
    else if (target === 'period') { setSelectedPeriod(null); setTemuan([]); }
    setStep(target);
  };

  const liveScore = useMemo(() => indicators.length > 0
    ? calculateQAScoreFromTemuan(indicators, temuan.map(t => ({ indicator_id: t.indicator_id, nilai: t.nilai, no_tiket: t.no_tiket })), activeWeight)
    : null, [indicators, temuan, activeWeight]);

  const groupedTemuan = useMemo(() => {
    const groups: { key: string; label: string | null; items: QATemuan[] }[] = [];
    const keyToGroup = new Map<string, number>();
    temuan.forEach(t => {
      const key = t.no_tiket?.trim() || `__solo_${t.id}`;
      if (!keyToGroup.has(key)) {
        keyToGroup.set(key, groups.length);
        groups.push({ key, label: t.no_tiket?.trim() || null, items: [] });
      }
      groups[keyToGroup.get(key)!].items.push(t);
    });
    return groups;
  }, [temuan]);

  const periodLabel = selectedPeriod ? `${MONTHS[selectedPeriod.month - 1]}_${selectedPeriod.year}` : '';

  // removed duplicate effectiveIsCollapsed

  return (
    <>
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-background">
        <header className="h-16 flex items-center justify-between px-4 lg:px-10 bg-background/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 -ml-2 rounded-xl hover:bg-foreground/5 text-muted-foreground transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base md:text-lg font-black text-foreground tracking-tight">Input Temuan SIDAK</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {mounted && (
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-xl hover:bg-foreground/5 text-muted-foreground transition-all">
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="flex items-center gap-1.5 text-[10px] md:text-xs font-black uppercase tracking-widest text-muted-foreground overflow-x-auto pb-2 scrollbar-none whitespace-nowrap">
              <button onClick={() => resetToStep('folder')} className={`transition-colors hover:text-primary ${step === 'folder' ? 'text-primary' : ''}`}>Folder</button>
              {selectedFolder && (<><ChevronRight className="w-3 h-3 opacity-30" /><button onClick={() => resetToStep('agent')} className={`transition-colors hover:text-primary ${step === 'agent' ? 'text-primary' : ''}`}>{selectedFolder}</button></>)}
              {selectedAgent  && (<><ChevronRight className="w-3 h-3 opacity-30" /><button onClick={() => resetToStep('period')} className={`transition-colors hover:text-primary ${step === 'period' ? 'text-primary' : ''}`}>{selectedAgent.nama}</button></>)}
              {selectedPeriod && (<><ChevronRight className="w-3 h-3 opacity-30" /><span className="text-primary">{MONTHS[selectedPeriod.month - 1]} {selectedPeriod.year}</span></>)}
            </div>

            {errorMsg && (
              <QaStatePanel
                type="error"
                title="Terjadi kendala saat memproses data"
                description={errorMsg}
                action={
                  <button
                    type="button"
                    onClick={() => setErrorMsg(null)}
                    className="inline-flex items-center gap-1 rounded-lg border border-current/30 px-2 py-1 text-[11px] font-bold uppercase tracking-wider opacity-80 hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                    Tutup
                  </button>
                }
              />
            )}
            {successMsg && (
              <QaStatePanel
                type="success"
                title="Perubahan berhasil disimpan"
                description={successMsg}
              />
            )}

            {loading && (
              <QaStatePanel
                type="loading"
                title="Memuat data SIDAK"
                description="Mohon tunggu sebentar, data sedang disiapkan."
              />
            )}

            {!loading && step === 'folder' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2"><FolderOpen className="w-5 h-5 text-primary"/><h2 className="text-lg font-bold">Pilih Folder</h2></div>
                <div className="grid gap-2">
                  {folders.map(f => (
                    <button key={f} onClick={() => handleSelectFolder(f)} className="flex items-center gap-4 px-5 py-4 bg-card border border-border hover:border-primary/40 rounded-2xl text-left transition-all group">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><FolderOpen className="w-5 h-5 text-primary"/></div>
                      <span className="flex-1 font-semibold">{f}</span>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary"/>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!loading && step === 'agent' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2"><UserIcon className="w-5 h-5 text-primary"/><h2 className="text-lg font-bold">Pilih Agent</h2></div>
                <div className="grid gap-2">
                  {agents.map(agent => (
                    <button key={agent.id} onClick={() => handleSelectAgent(agent)} className="flex items-center gap-4 px-5 py-4 bg-card border border-border hover:border-primary/40 rounded-2xl text-left transition-all group">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"><span className="font-black text-primary">{agent.nama.charAt(0)}</span></div>
                      <div className="flex-1 min-w-0"><p className="font-semibold truncate">{agent.nama}</p><p className="text-xs text-muted-foreground">{agent.tim}</p></div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary"/>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!loading && step === 'period' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2"><CalendarDays className="w-5 h-5 text-primary"/><h2 className="text-lg font-bold">Pilih Periode</h2></div>
                <div className="grid gap-2">
                  {periods.map(p => (
                    <button key={p.id} onClick={() => handleSelectPeriod(p)} className="flex items-center gap-4 px-5 py-4 bg-card border border-border hover:border-primary/40 rounded-2xl text-left transition-all group">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0"><span className="font-black text-primary">{String(p.month).padStart(2,'0')}</span></div>
                      <div className="flex-1"><p className="font-semibold">{MONTHS[p.month-1]}</p><p className="text-xs text-muted-foreground">{p.year}</p></div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary"/>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!loading && step === 'list' && selectedAgent && selectedPeriod && (
              <div className="space-y-6">
                {/* ── Layanan & Tim Dropdowns ─────────────────── */}
                <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Konfigurasi Audit</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Layanan Dropdown */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Layanan Audit</label>
                      <select
                        value={selectedService}
                        onChange={(e) => handleServiceChange(e.target.value as ServiceType)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                      >
                        {(Object.entries(SERVICE_LABELS) as [ServiceType, string][]).map(([val, lbl]) => (
                          <option key={val} value={val}>{lbl}</option>
                        ))}
                      </select>
                    </div>
                    {/* Tim Dropdown */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Tim Agent</label>
                      <select
                        value={selectedTeam}
                        onChange={(e) => setSelectedTeam(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                      >
                        {Object.keys(TIM_TO_DEFAULT_SERVICE).map(tim => (
                          <option key={tim} value={tim}>{tim}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                {liveScore && (
                  <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Estimasi Skor ({activeWeight.scoring_mode.replace('_', ' ')})</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{selectedAgent.nama} · {MONTHS[selectedPeriod.month-1]} {selectedPeriod.year}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-4xl font-black ${scoreColor(liveScore.finalScore)}`}>{liveScore.finalScore.toFixed(1)}</p>
                        <p className={`text-xs font-semibold ${scoreColor(liveScore.finalScore)}`}>{scoreLabel(liveScore.finalScore)}</p>
                      </div>
                    </div>
                    {activeWeight.scoring_mode === 'weighted' ? (
                      <div className="grid grid-cols-1 gap-3 mb-4 sm:grid-cols-2">
                        <div className="bg-blue-500/10 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-blue-500 font-bold uppercase">Non-Critical ({Math.round(activeWeight.non_critical_weight * 100)}%)</p>
                          <p className={`text-xl font-black ${scoreColor(liveScore.nonCriticalScore)}`}>{liveScore.nonCriticalScore.toFixed(1)}</p>
                        </div>
                        <div className="bg-red-500/10 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-red-500 font-bold uppercase">Critical ({Math.round(activeWeight.critical_weight * 100)}%)</p>
                          <p className={`text-xl font-black ${scoreColor(liveScore.criticalScore)}`}>{liveScore.criticalScore.toFixed(1)}</p>
                        </div>
                      </div>
                    ) : activeWeight.scoring_mode === 'flat' ? (
                      <div className="bg-primary/5 rounded-xl p-4 mb-4 border border-primary/10">
                        <div className="flex justify-between items-center mb-1 text-[10px] font-black uppercase text-muted-foreground">
                          <span>Sistem Penilaian Flat</span>
                          <span>{Math.round(activeWeight.non_critical_weight * 100)}% NC + {Math.round(activeWeight.critical_weight * 100)}% CR</span>
                        </div>
                        <p className="text-xs font-bold text-muted-foreground leading-relaxed text-center">Skor dihitung langsung dari total bobot parameter yang terpenuhi.</p>
                      </div>
                    ) : (
                      <div className="bg-foreground/5 rounded-xl p-4 mb-4 border border-border/50">
                        <p className="text-[10px] font-black uppercase text-muted-foreground text-center mb-1">Mode No Category (BKO)</p>
                        <p className="text-xs font-bold text-muted-foreground text-center leading-relaxed">Semua parameter memiliki derajat yang sama tanpa pemisahan kategori.</p>
                      </div>
                    )}
                    <div className="h-2.5 bg-foreground/5 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${scoreBg(liveScore.finalScore)}`} style={{width:`${liveScore.finalScore}%`}}/></div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div><h3 className="font-bold">Daftar Temuan</h3><p className="text-xs text-muted-foreground">{temuan.length} temuan · {groupedTemuan.length} sesi</p></div>
                  {!showForm && !showImport && (() => {
                    const hasBadFindings = temuan.some(t => t.nilai < 3);
                    return (
                      <div className="flex flex-wrap items-center gap-2 justify-end">
                        {role !== 'leader' && (
                          <>
                            <button onClick={() => { setShowImport(true); setImportTab('download'); setImportRows([]); setImportFile(null); }} className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border hover:border-primary/40 rounded-xl text-sm font-semibold transition-all"><FileSpreadsheet className="w-4 h-4"/>Import</button>
                            <button onClick={handlePerfectScore} disabled={saving || hasBadFindings} className={`flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 ${hasBadFindings ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-600'}`} title={hasBadFindings ? "Sesi tanpa temuan hanya bisa dibuat jika belum ada laporan temuan buruk." : ""}><Check className="w-4 h-4"/>{hasBadFindings ? 'Sudah Ada Temuan' : 'Sesi Tanpa Temuan'}</button>
                            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary/20"><Plus className="w-4 h-4"/>Tambah</button>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {showImport && (
                  <div className="bg-card rounded-2xl border border-primary/20 overflow-hidden shadow-xl">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-primary/5">
                      <div className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-primary"/><p className="font-bold">Import dari Excel</p></div>
                      <button onClick={() => { setShowImport(false); setImportRows([]); setImportFile(null); }} className="p-2 rounded-lg hover:bg-foreground/5 text-muted-foreground"><X className="w-5 h-5"/></button>
                    </div>
                    <div className="flex border-b border-border">
                      {(['download', 'upload'] as const).map(tab => (
                        <button key={tab} onClick={() => setImportTab(tab)} className={`flex-1 py-3 text-xs font-bold transition-colors ${importTab === tab ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                          {tab === 'download' ? 'Download Template' : 'Upload & Preview'}
                        </button>
                      ))}
                    </div>
                    <div className="p-6 space-y-6">
                      {importTab === 'download' ? (
                        <div className="space-y-4">
                          <div className="bg-blue-500/10 rounded-2xl p-4 border border-blue-500/20"><p className="text-xs font-bold text-blue-500 mb-2">Cara menggunakan template</p><ul className="space-y-1.5 text-xs text-muted-foreground"><li className="flex items-start gap-2"><span className="font-black mt-0.5">·</span>Sheet <strong>Input Temuan</strong>: isi no. tiket, pilih parameter, isi nilai 0–3</li><li className="flex items-start gap-2"><span className="font-black mt-0.5">·</span>Parameter dengan nilai 3 (Sesuai) tidak perlu diisi</li></ul></div>
                          <button 
                            onClick={handleDownloadTemplate} 
                            disabled={generatingTemplate}
                            className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground rounded-xl font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
                          >
                            {generatingTemplate ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5"/>}
                            {generatingTemplate ? 'Menyiapkan...' : 'Download Template'}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <label className={`flex flex-col items-center justify-center gap-4 py-12 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${importFile ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange}/>
                            {parsing ? <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"/> : importFile ? <><FileSpreadsheet className="w-10 h-10 text-primary"/><div className="text-center"><p className="font-semibold">{importFile.name}</p><p className="text-xs text-muted-foreground mt-1">Klik untuk ganti file</p></div></> : <><Upload className="w-10 h-10 text-muted-foreground"/><div className="text-center"><p className="font-semibold text-muted-foreground">Pilih file Excel</p><p className="text-xs text-muted-foreground mt-1">.xlsx atau .xls</p></div></>}
                          </label>
                          {importRows.length > 0 && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-2">
                                <div className="bg-green-500/10 rounded-xl p-3 text-center border border-green-500/20"><p className="text-xl font-black text-green-500">{validImportRows.length}</p><p className="text-[10px] text-green-500 font-bold">Siap import</p></div>
                                {invalidImportRows.length > 0 && <div className="bg-red-500/10 rounded-xl p-3 text-center border border-red-500/20"><p className="text-xl font-black text-red-500">{invalidImportRows.length}</p><p className="text-[10px] text-red-500 font-bold">Error</p></div>}
                              </div>
                              <div className="rounded-2xl border border-border overflow-hidden max-h-60 overflow-y-auto">
                                {importRows.map(row => (
                                  <div key={row.rowNum} className={`px-4 py-3 border-b border-border last:border-0 ${row.errors.length > 0 ? 'bg-red-500/5' : ''}`}>
                                    <div className="flex items-start gap-3"><span className="text-[10px] font-mono text-muted-foreground mt-0.5 w-6">R{row.rowNum}</span><div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap">{row.no_tiket && <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">{row.no_tiket}</span>}<span className="text-xs font-semibold truncate">{row.paramName || '—'}</span>{row.nilai !== null && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${NILAI_BADGE[row.nilai]}`}>{row.nilai}</span>}</div>{row.errors.length > 0 && <p className="text-[10px] text-red-500 mt-1">{row.errors.join('; ')}</p>}</div><span className={`text-[10px] font-bold ${row.errors.length > 0 ? 'text-red-500' : 'text-green-500'}`}>{row.errors.length > 0 ? '✗' : '✓'}</span></div>
                                  </div>
                                ))}
                              </div>
                              {validImportRows.length > 0 && <button onClick={handleImportSave} disabled={importing} className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground rounded-xl font-bold shadow-lg shadow-primary/20">{importing ? <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"/> : <Check className="w-5 h-5"/>}{importing ? 'Menyimpan...' : `Import ${validImportRows.length} Temuan`}</button>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {showForm && (
                  <div className="bg-card rounded-2xl border border-primary/20 overflow-hidden shadow-xl">
                    <div className="px-6 py-4 border-b border-border bg-primary/5"><p className="font-bold">Temuan Baru</p><p className="text-xs text-muted-foreground mt-0.5">Satu tiket bisa memiliki beberapa temuan</p></div>
                    <div className="p-6 space-y-6">
                      <div><label className="text-xs font-bold text-muted-foreground mb-2 block uppercase tracking-wider">No. Tiket</label><input value={noTiket} onChange={e => setNoTiket(e.target.value)} placeholder="Contoh: L202503001" className="w-full px-4 py-3 rounded-xl border border-border bg-foreground/5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"/></div>
                      <div className="space-y-4">
                        {entries.map((entry, idx) => (
                          <div key={entry.uid} className="rounded-2xl border border-border overflow-visible bg-foreground/[0.02]">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border"><p className="text-xs font-bold text-muted-foreground uppercase">Parameter {idx + 1}</p>{entries.length > 1 && <button onClick={() => setEntries(prev => prev.filter(e => e.uid !== entry.uid))} className="text-muted-foreground hover:text-red-500 p-1.5 rounded-lg hover:bg-red-500/10"><Trash2 className="w-4 h-4"/></button>}</div>
                            <div className="p-4 space-y-4">
                              <div><label className="text-xs font-bold text-muted-foreground mb-2 block uppercase tracking-wider">Parameter</label><IndicatorDropdown value={entry.indicator_id} indicators={indicators} scoringMode={activeWeight.scoring_mode} open={entry.showDropdown} onToggle={() => { closeAllDropdowns(); updateEntry(entry.uid, { showDropdown: !entry.showDropdown }); }} onSelect={id => updateEntry(entry.uid, { indicator_id: id, showDropdown: false })}/></div>
                              <div><label className="text-xs font-bold text-muted-foreground mb-2 block uppercase tracking-wider">Nilai</label><div className="grid grid-cols-4 gap-2">{NILAI_OPTIONS.map(opt => <button key={opt.v} type="button" onClick={() => updateEntry(entry.uid, { nilai: opt.v })} className={`py-3 rounded-xl border-2 transition-all text-center ${entry.nilai === opt.v ? opt.active : opt.inactive}`}><p className="text-lg font-black">{opt.v}</p><p className="text-[9px] font-bold uppercase opacity-60">{opt.sub.split(' ')[0]}</p></button>)}</div></div>
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div><label className="text-xs font-bold text-muted-foreground mb-2 block uppercase tracking-wider">Ketidaksesuaian</label><textarea value={entry.ketidaksesuaian} onChange={e => updateEntry(entry.uid, { ketidaksesuaian: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"/></div>
                                <div><label className="text-xs font-bold text-muted-foreground mb-2 block uppercase tracking-wider">Sebaiknya</label><textarea value={entry.sebaiknya} onChange={e => updateEntry(entry.uid, { sebaiknya: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"/></div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => setEntries(prev => [...prev, newEntry()])} className="w-full py-3 border-2 border-dashed border-primary/20 rounded-2xl text-sm font-bold text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2"><Plus className="w-4 h-4"/>Tambah Parameter</button>
                      <div className="flex flex-col gap-3 pt-2 sm:flex-row"><button onClick={handleSave} disabled={saving || entries.some(e => !e.indicator_id)} className="flex-1 py-3.5 bg-primary text-primary-foreground rounded-xl font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2">{saving ? <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"/> : <Check className="w-5 h-5"/>}{saving ? 'Menyimpan...' : 'Simpan Temuan'}</button><button onClick={resetForm} className="px-6 py-3.5 bg-foreground/5 text-muted-foreground rounded-xl font-bold sm:w-auto">Batal</button></div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {groupedTemuan.map((group, gIdx) => (
                    <div key={group.key} className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
                      <div className="flex items-center gap-3 px-5 py-3 bg-foreground/[0.02] border-b border-border">
                        <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-black text-[10px]">{gIdx + 1}</div>
                        {group.label ? <span className="text-xs font-mono font-bold text-primary">{group.label}</span> : <span className="text-xs text-muted-foreground italic">Tanpa no. tiket</span>}
                        <span className="text-[10px] text-muted-foreground ml-auto font-bold uppercase tracking-wider">{group.items.length} temuan</span>
                      </div>
                      <div className="divide-y divide-border">
                        {group.items.map((t, _iIdx) => {
                          const ind = unwrapIndicator(t.qa_indicators);
                          const isCritical = ind?.category === 'critical';
                          const isEditing  = editingId === t.id;
                          return (
                            <div key={t.id} className="p-5">
                              <div className="flex items-start gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <p className="font-bold text-foreground">{ind?.name ?? '-'}</p>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isCritical ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>{isCritical ? 'Critical' : 'Non-Critical'}</span>
                                  </div>
                                  {!isEditing && (
                                    <div className="space-y-1">
                                      {t.ketidaksesuaian && <p className="text-xs text-muted-foreground"><span className="font-bold text-foreground/80">Ketidaksesuaian: </span>{t.ketidaksesuaian}</p>}
                                      {t.sebaiknya && <p className="text-xs text-muted-foreground"><span className="font-bold text-foreground/80">Sebaiknya: </span>{t.sebaiknya}</p>}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                  <div className="text-center">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white ${NILAI_BADGE[t.nilai]}`}>{t.nilai}</div>
                                    <p className={`text-[9px] font-bold uppercase mt-1 ${t.nilai===3?'text-green-500':t.nilai===2?'text-amber-500':t.nilai===1?'text-orange-500':'text-red-500'}`}>{NILAI_LABELS[t.nilai]}</p>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    {role !== 'leader' && (
                                      deletingId === t.id ? (
                                        <><button onClick={() => handleDelete(t.id)} className="text-[10px] font-bold text-red-500 px-2 py-1 border border-red-500/20 rounded-lg hover:bg-red-500/10">Ya</button><button onClick={() => setDeletingId(null)} className="text-[10px] font-bold text-muted-foreground px-2 py-1 border border-border rounded-lg hover:bg-foreground/5">Batal</button></>
                                      ) : (
                                        <><button onClick={() => isEditing ? cancelEdit() : startEdit(t)} className={`p-2 rounded-lg transition-colors ${isEditing ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-primary hover:bg-primary/5'}`}><Pencil className="w-4 h-4"/></button><button onClick={() => handleDelete(t.id)} className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/5 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button></>
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>
                              {isEditing && (
                                <div className="mt-4 p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-4 animate-in fade-in slide-in-from-top-2">
                                  <p className="text-xs font-bold text-primary uppercase tracking-wider">Edit Temuan</p>
                                  <div><label className="text-[10px] font-bold text-muted-foreground mb-2 block uppercase tracking-wider">Nilai</label><div className="grid grid-cols-4 gap-2">{NILAI_OPTIONS.map(opt => <button key={opt.v} type="button" onClick={() => setEditNilai(opt.v)} className={`py-2 rounded-xl border-2 transition-all text-center ${editNilai === opt.v ? opt.active : opt.inactive}`}><p className="text-base font-black">{opt.v}</p></button>)}</div></div>
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div><label className="text-[10px] font-bold text-muted-foreground mb-2 block uppercase tracking-wider">Ketidaksesuaian</label><textarea value={editKetidaksesuaian} onChange={e => setEditKetidaksesuaian(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary resize-none"/></div>
                                    <div><label className="text-[10px] font-bold text-muted-foreground mb-2 block uppercase tracking-wider">Sebaiknya</label><textarea value={editSebaiknya} onChange={e => setEditSebaiknya(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary resize-none"/></div>
                                  </div>
                                  <div className="flex gap-2"><button onClick={() => handleSaveEdit(t.id)} disabled={savingEdit} className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2">{savingEdit ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"/> : <Check className="w-4 h-4"/>}{savingEdit ? 'Menyimpan...' : 'Simpan'}</button><button onClick={cancelEdit} className="px-4 py-2.5 bg-foreground/5 text-muted-foreground rounded-xl font-bold text-xs">Batal</button></div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
