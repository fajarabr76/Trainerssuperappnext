'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Shield, ShieldCheck, ShieldOff, Check, X, UserCheck, Clock, Loader2, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import PageHeroHeader from '@/app/components/PageHeroHeader';
import type { PendingLeaderRequest, ApprovedLeaderAccess, AccessGroupRow } from '@/app/actions/leader-access';
import {
  approveLeaderAccessRequest,
  rejectLeaderAccessRequest,
  revokeLeaderAccessRequest,
  reassignLeaderAccessGroups,
} from '@/app/actions/leader-access';

interface Props {
  role: string;
  initialPending: PendingLeaderRequest[];
  initialApproved: ApprovedLeaderAccess[];
  accessGroups: AccessGroupRow[];
}

const moduleLabels: Record<string, string> = {
  ktp: 'KTP / Profiler',
  sidak: 'SIDAK / QA Analyzer',
  all: 'Semua Modul',
};

export default function AccessApprovalClient({ role: _role, initialPending, initialApproved, accessGroups }: Props) {
  const [tab, setTab] = useState<'pending' | 'approved'>('pending');
  const [pending, setPending] = useState(initialPending);
  const [approved, setApproved] = useState(initialApproved);
  const [processing, setProcessing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const activeGroups = accessGroups.filter((g) => g.is_active);

  const handleApprove = async (requestId: string, groupIds: string[]) => {
    if (groupIds.length === 0) {
      setMessage({ type: 'error', text: 'Pilih minimal satu access group' });
      return;
    }
    setProcessing(requestId);
    setMessage(null);
    try {
      const result = await approveLeaderAccessRequest(requestId, groupIds);
      if (result.success) {
        setPending((prev) => prev.filter((r) => r.id !== requestId));
        setMessage({ type: 'success', text: result.message });
        // Refresh approved list by reloading page (simple approach for v1)
        window.location.reload();
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch {
      setMessage({ type: 'error', text: 'Gagal menyetujui request' });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessing(requestId);
    setMessage(null);
    try {
      const result = await rejectLeaderAccessRequest(requestId);
      if (result.success) {
        setPending((prev) => prev.filter((r) => r.id !== requestId));
        setMessage({ type: 'success', text: result.message });
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch {
      setMessage({ type: 'error', text: 'Gagal menolak request' });
    } finally {
      setProcessing(null);
    }
  };

  const handleRevoke = async (requestId: string) => {
    setProcessing(requestId);
    setMessage(null);
    try {
      const result = await revokeLeaderAccessRequest(requestId);
      if (result.success) {
        setApproved((prev) => prev.filter((r) => r.id !== requestId));
        setMessage({ type: 'success', text: result.message });
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch {
      setMessage({ type: 'error', text: 'Gagal mencabut akses' });
    } finally {
      setProcessing(null);
    }
  };

  const handleReassign = async (requestId: string, groupIds: string[]) => {
    if (groupIds.length === 0) {
      setMessage({ type: 'error', text: 'Pilih minimal satu access group' });
      return;
    }
    setProcessing(requestId);
    setMessage(null);
    try {
      const result = await reassignLeaderAccessGroups(requestId, groupIds);
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        window.location.reload();
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch {
      setMessage({ type: 'error', text: 'Gagal memperbarui access group' });
    } finally {
      setProcessing(null);
    }
  };

  return (
    <>
      <PageHeroHeader
        eyebrow="Admin & Trainer"
        title="Access Approval"
        description="Kelola permintaan akses data leader untuk modul KTP dan SIDAK"
        icon={<Shield className="w-4 h-4" />}
      />

      {/* Message */}
      {message && (
        <div className={`mb-6 rounded-2xl p-4 text-sm font-medium ${
          message.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
            : 'bg-red-500/10 text-red-600 border border-red-500/20'
        }`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-1.5 shadow-sm mb-8">
        <button
          onClick={() => setTab('pending')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
            tab === 'pending'
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
              : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Pending</span>
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${tab === 'pending' ? 'bg-white/20' : 'bg-foreground/10'}`}>
            {pending.length}
          </span>
        </button>
        <button
          onClick={() => setTab('approved')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
            tab === 'approved'
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
              : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Disetujui</span>
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${tab === 'approved' ? 'bg-white/20' : 'bg-foreground/10'}`}>
            {approved.length}
          </span>
        </button>
      </div>

      {/* Pending tab */}
      {tab === 'pending' && (
        <PendingList
          requests={pending}
          activeGroups={activeGroups}
          processing={processing}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      {/* Approved tab */}
      {tab === 'approved' && (
        <ApprovedList
          requests={approved}
          activeGroups={activeGroups}
          processing={processing}
          onRevoke={handleRevoke}
          onReassign={handleReassign}
        />
      )}
    </>
  );
}

function PendingList({
  requests,
  activeGroups,
  processing,
  onApprove,
  onReject,
}: {
  requests: PendingLeaderRequest[];
  activeGroups: AccessGroupRow[];
  processing: string | null;
  onApprove: (id: string, groups: string[]) => void;
  onReject: (id: string) => void;
}) {
  const [selectedGroups, setSelectedGroups] = useState<Record<string, string[]>>({});
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const closeDropdown = () => {
    setOpenDropdown(null);
    setDropdownPosition(null);
  };

  const handleTriggerClick = (reqId: string, button: HTMLButtonElement) => {
    if (openDropdown === reqId) {
      closeDropdown();
      return;
    }
    const rect = button.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + 8,
      left: Math.max(rect.left, 8),
      width: Math.max(rect.width, 220),
    });
    setOpenDropdown(reqId);
  };

  if (requests.length === 0) {
    return (
      <div className="bg-card border border-border rounded-[2rem] p-10 text-center">
        <ShieldCheck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground font-medium">Tidak ada permintaan pending</p>
      </div>
    );
  }

  // Dropdown portal rendered at document.body level to avoid overflow/z-index clipping
  const dropdownPortal =
    typeof document !== 'undefined' &&
    openDropdown !== null &&
    dropdownPosition
      ? createPortal(
          <>
            {/* Backdrop to close dropdown on outside click */}
            <div className="fixed inset-0 z-[9998]" onClick={closeDropdown} />
            <AnimatePresence>
              {(() => {
                const reqId = openDropdown;
                const groups = selectedGroups[reqId] || [];
                return (
                  <motion.div
                    key={reqId}
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: 'fixed',
                      top: dropdownPosition.top,
                      left: dropdownPosition.left,
                      width: dropdownPosition.width,
                    }}
                    role="listbox"
                    aria-label="Pilih access group"
                    className="z-[9999] min-w-[200px] bg-card/95 backdrop-blur-xl border border-border/40 rounded-2xl shadow-2xl overflow-hidden py-1"
                  >
                    {activeGroups.map((group) => {
                      const selected = groups.includes(group.id);
                      return (
                        <button
                          key={group.id}
                          role="option"
                          aria-selected={selected}
                          onClick={() => {
                            setSelectedGroups((prev) => {
                              const current = prev[reqId] || [];
                              return {
                                ...prev,
                                [reqId]: selected
                                  ? current.filter((id) => id !== group.id)
                                  : [...current, group.id],
                              };
                            });
                          }}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-left text-xs font-medium transition-colors hover:bg-foreground/5"
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                              selected
                                ? 'bg-primary border-primary text-white'
                                : 'border-muted-foreground/30'
                            }`}
                          >
                            {selected && <Check className="w-3 h-3" />}
                          </div>
                          <span className={selected ? 'font-semibold' : ''}>{group.name}</span>
                        </button>
                      );
                    })}
                  </motion.div>
                );
              })()}
            </AnimatePresence>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      {dropdownPortal}
      <div className="bg-card border border-border rounded-[2.5rem] overflow-hidden shadow-2xl relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

        <div className="overflow-x-auto relative">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-foreground/[0.02] border-b border-border">
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest opacity-40">Leader</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest opacity-40">Modul</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest opacity-40">Tanggal</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest opacity-40">Access Groups</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest opacity-40 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.map((req) => {
                const isProcessing = processing === req.id;
                const groups = selectedGroups[req.id] || [];

                return (
                  <tr key={req.id} className="hover:bg-foreground/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold">{req.leader_name}</p>
                      <p className="text-xs text-muted-foreground">{req.leader_email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] bg-amber-500/10 text-amber-600">
                        {moduleLabels[req.module] || req.module}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(req.created_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-6 py-4">
                      {activeGroups.length > 0 ? (
                        <button
                          onClick={(e) => handleTriggerClick(req.id, e.currentTarget)}
                          disabled={isProcessing}
                          aria-expanded={openDropdown === req.id}
                          aria-haspopup="listbox"
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                            groups.length > 0
                              ? 'bg-primary/10 text-primary border-primary/30'
                              : 'bg-foreground/5 text-muted-foreground border-border hover:border-foreground/20'
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          <span>
                            {groups.length === 0
                              ? 'Pilih group'
                              : groups.length === 1
                                ? activeGroups.find((g) => g.id === groups[0])?.name
                                : `${groups.length} group dipilih`}
                          </span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform duration-300 ${
                              openDropdown === req.id ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Tidak ada access group</span>
                      )}
                    </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onApprove(req.id, groups)}
                        disabled={isProcessing}
                        className="inline-flex items-center gap-1.5 bg-emerald-500 text-white rounded-xl px-3 py-1.5 text-xs font-semibold shadow-lg shadow-emerald-500/20 hover:brightness-110 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Setujui
                      </button>
                      <button
                        onClick={() => onReject(req.id)}
                        disabled={isProcessing}
                        className="inline-flex items-center gap-1.5 border border-red-500/20 bg-red-500/10 text-red-600 rounded-xl px-3 py-1.5 text-xs font-semibold hover:bg-red-500/15 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <X className="w-3 h-3" />
                        Tolak
                      </button>
                    </div>
                  </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function ApprovedList({
  requests,
  activeGroups,
  processing,
  onRevoke,
  onReassign,
}: {
  requests: ApprovedLeaderAccess[];
  activeGroups: AccessGroupRow[];
  processing: string | null;
  onRevoke: (id: string) => void;
  onReassign: (id: string, groups: string[]) => void;
}) {
  const [selectedGroups, setSelectedGroups] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    requests.forEach((req) => {
      initial[req.id] = req.access_group_ids;
    });
    return initial;
  });
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const closeDropdown = () => {
    setOpenDropdown(null);
    setDropdownPosition(null);
  };

  const handleTriggerClick = (reqId: string, button: HTMLButtonElement) => {
    if (openDropdown === reqId) {
      closeDropdown();
      return;
    }
    const rect = button.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + 8,
      left: Math.max(rect.left, 8),
      width: Math.max(rect.width, 220),
    });
    setOpenDropdown(reqId);
  };

  if (requests.length === 0) {
    return (
      <div className="bg-card border border-border rounded-[2rem] p-10 text-center">
        <UserCheck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground font-medium">Belum ada akses yang disetujui</p>
      </div>
    );
  }

  const dropdownPortal =
    typeof document !== 'undefined' &&
    openDropdown !== null &&
    dropdownPosition
      ? createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={closeDropdown} />
            <AnimatePresence>
              {(() => {
                const reqId = openDropdown;
                const groups = selectedGroups[reqId] || [];
                return (
                  <motion.div
                    key={reqId}
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: 'fixed',
                      top: dropdownPosition.top,
                      left: dropdownPosition.left,
                      width: dropdownPosition.width,
                    }}
                    role="listbox"
                    aria-label="Pilih access group"
                    className="z-[9999] min-w-[200px] bg-card/95 backdrop-blur-xl border border-border/40 rounded-2xl shadow-2xl overflow-hidden py-1"
                  >
                    {activeGroups.map((group) => {
                      const selected = groups.includes(group.id);
                      return (
                        <button
                          key={group.id}
                          role="option"
                          aria-selected={selected}
                          onClick={() => {
                            setSelectedGroups((prev) => {
                              const current = prev[reqId] || [];
                              return {
                                ...prev,
                                [reqId]: selected
                                  ? current.filter((id) => id !== group.id)
                                  : [...current, group.id],
                              };
                            });
                          }}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-left text-xs font-medium transition-colors hover:bg-foreground/5"
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                              selected
                                ? 'bg-primary border-primary text-white'
                                : 'border-muted-foreground/30'
                            }`}
                          >
                            {selected && <Check className="w-3 h-3" />}
                          </div>
                          <span className={selected ? 'font-semibold' : ''}>{group.name}</span>
                        </button>
                      );
                    })}
                  </motion.div>
                );
              })()}
            </AnimatePresence>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      {dropdownPortal}
      <div className="bg-card border border-border rounded-[2.5rem] overflow-hidden shadow-2xl relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
        <div className="overflow-x-auto relative">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-foreground/[0.02] border-b border-border">
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest opacity-40">Leader</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest opacity-40">Modul</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest opacity-40">Access Groups</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest opacity-40">Disetujui</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest opacity-40 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.map((req) => {
                const isProcessing = processing === req.id;
                const groups = selectedGroups[req.id] || [];

                return (
                  <tr key={req.id} className="hover:bg-foreground/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold">{req.leader_name}</p>
                      <p className="text-xs text-muted-foreground">{req.leader_email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] bg-emerald-500/10 text-emerald-600">
                        {moduleLabels[req.module] || req.module}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {activeGroups.length > 0 ? (
                        <button
                          onClick={(e) => handleTriggerClick(req.id, e.currentTarget)}
                          disabled={isProcessing}
                          aria-expanded={openDropdown === req.id}
                          aria-haspopup="listbox"
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                            groups.length > 0
                              ? 'bg-primary/10 text-primary border-primary/30'
                              : 'bg-foreground/5 text-muted-foreground border-border hover:border-foreground/20'
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          <span>
                            {groups.length === 0
                              ? 'Pilih group'
                              : groups.length === 1
                                ? activeGroups.find((g) => g.id === groups[0])?.name
                                : `${groups.length} group dipilih`}
                          </span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform duration-300 ${
                              openDropdown === req.id ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Tidak ada access group</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(req.approved_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onReassign(req.id, groups)}
                          disabled={isProcessing}
                          className="inline-flex items-center gap-1.5 bg-emerald-500 text-white rounded-xl px-3 py-1.5 text-xs font-semibold shadow-lg shadow-emerald-500/20 hover:brightness-110 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Simpan Group
                        </button>
                        <button
                          onClick={() => onRevoke(req.id)}
                          disabled={isProcessing}
                          className="inline-flex items-center gap-1.5 border border-red-500/20 bg-red-500/10 text-red-600 rounded-xl px-3 py-1.5 text-xs font-semibold hover:bg-red-500/15 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldOff className="w-3 h-3" />}
                          Cabut
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
