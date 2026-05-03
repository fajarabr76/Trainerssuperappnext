'use client';

import { useMemo, useState } from 'react';
import { Layers, Plus, Trash2, Edit2, Loader2, Save, X } from 'lucide-react';
import PageHeroHeader from '@/app/components/PageHeroHeader';
import type { AccessGroupRow, AccessGroupItemRow, AccessScopeOptions } from '@/app/actions/leader-access';
import {
  createAccessGroup,
  updateAccessGroup,
  getAccessGroupItems,
  addAccessGroupItem,
  removeAccessGroupItem,
} from '@/app/actions/leader-access';

interface Props {
  role: string;
  initialGroups: AccessGroupRow[];
  scopeOptions: AccessScopeOptions;
}

type ScopeBuilderMode = 'team' | 'service' | 'name';

const FIELD_LABELS: Record<string, string> = {
  peserta_id: 'Nama',
  batch_name: 'Batch Name',
  tim: 'Tim',
  service_type: 'Service Type',
};

export default function AccessGroupsClient({ role: _role, initialGroups, scopeOptions }: Props) {
  const [groups, setGroups] = useState(initialGroups);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [items, setItems] = useState<AccessGroupItemRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Guided scope builder
  const [scopeMode, setScopeMode] = useState<ScopeBuilderMode>('team');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  // New group form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const availableAgentsForTeam = selectedTeam ? scopeOptions.agentsByTeam[selectedTeam] || [] : [];
  const agentOptionById = useMemo(() => {
    const map = new Map<string, AccessScopeOptions['agentsByTeam'][string][number]>();
    Object.values(scopeOptions.agentsByTeam).forEach((agents) => {
      agents.forEach((agent) => {
        map.set(agent.id, agent);
      });
    });
    return map;
  }, [scopeOptions.agentsByTeam]);

  const resetScopeBuilder = () => {
    setSelectedTeam('');
    setSelectedService('');
    setSelectedAgentId('');
  };

  const handleCreateGroup = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setMessage(null);
    try {
      const result = await createAccessGroup(newName.trim(), newDesc.trim() || undefined);
      if (result.success) {
        setNewName('');
        setNewDesc('');
        setShowNewForm(false);
        setMessage({ type: 'success', text: result.message });
        window.location.reload();
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch {
      setMessage({ type: 'error', text: 'Gagal membuat access group' });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateGroup = async (id: string) => {
    setCreating(true);
    setMessage(null);
    try {
      const result = await updateAccessGroup(id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      });
      if (result.success) {
        setEditingId(null);
        setMessage({ type: 'success', text: result.message });
        window.location.reload();
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch {
      setMessage({ type: 'error', text: 'Gagal mengupdate access group' });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    setMessage(null);
    try {
      const result = await updateAccessGroup(id, { is_active: !currentActive });
      if (result.success) {
        setGroups((prev) =>
          prev.map((g) => (g.id === id ? { ...g, is_active: !currentActive } : g))
        );
        setMessage({ type: 'success', text: result.message });
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch {
      setMessage({ type: 'error', text: 'Gagal mengupdate status group' });
    }
  };

  const handleExpand = async (groupId: string) => {
    if (expandedId === groupId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(groupId);
    setLoadingItems(true);
    try {
      const result = await getAccessGroupItems(groupId);
      setItems(result);
    } catch {
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleAddItem = async (groupId: string) => {
    let fieldName = 'tim';
    let fieldValue = selectedTeam;

    if (scopeMode === 'service') {
      fieldName = 'service_type';
      fieldValue = selectedService;
    }

    if (scopeMode === 'name') {
      fieldName = 'peserta_id';
      fieldValue = selectedAgentId;
    }

    if (!fieldValue.trim()) return;
    setAddingItem(true);
    setMessage(null);
    try {
      const result = await addAccessGroupItem(groupId, fieldName, fieldValue.trim());
      if (result.success) {
        resetScopeBuilder();
        const updated = await getAccessGroupItems(groupId);
        setItems(updated);
        setMessage({ type: 'success', text: result.message });
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch {
      setMessage({ type: 'error', text: 'Gagal menambah item' });
    } finally {
      setAddingItem(false);
    }
  };

  const handleRemoveItem = async (itemId: string, _groupId: string) => {
    setMessage(null);
    try {
      const result = await removeAccessGroupItem(itemId);
      if (result.success) {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        setMessage({ type: 'success', text: result.message });
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch {
      setMessage({ type: 'error', text: 'Gagal menghapus item' });
    }
  };

  const startEdit = (group: AccessGroupRow) => {
    setEditingId(group.id);
    setEditName(group.name);
    setEditDesc(group.description || '');
  };

  const canAddScopeItem =
    (scopeMode === 'team' && Boolean(selectedTeam)) ||
    (scopeMode === 'service' && Boolean(selectedService)) ||
    (scopeMode === 'name' && Boolean(selectedTeam) && Boolean(selectedAgentId));

  const getScopeItemDisplayValue = (item: AccessGroupItemRow) => {
    if (item.field_name === 'peserta_id') {
      const agent = agentOptionById.get(item.field_value);
      if (agent) {
        return `${agent.name}${agent.batch_name ? ` - ${agent.batch_name}` : ''}`;
      }
    }

    if (item.field_name === 'service_type') {
      return scopeOptions.services.find((service) => service.value === item.field_value)?.label || item.field_value;
    }

    return item.field_value;
  };

  const renderAddScopeItemForm = (groupId: string) => (
    /* Add item form */
    <div className="space-y-4 bg-background/30 rounded-2xl p-4 mb-4">
      <div className="flex flex-wrap gap-2">
        {([
          ['team', 'By Team'],
          ['service', 'By Service'],
          ['name', 'By Name'],
        ] as const).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => {
              setScopeMode(mode);
              resetScopeBuilder();
            }}
            className={`rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
              scopeMode === mode
                ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'border-border bg-card text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        {(scopeMode === 'team' || scopeMode === 'name') && (
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Team
            </label>
            <select
              value={selectedTeam}
              onChange={(e) => {
                setSelectedTeam(e.target.value);
                setSelectedAgentId('');
              }}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-primary"
            >
              <option value="">Pilih Team</option>
              {scopeOptions.teams.map((team) => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
          </div>
        )}

        {scopeMode === 'service' && (
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Service
            </label>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-primary"
            >
              <option value="">Pilih Service</option>
              {scopeOptions.services.map((service) => (
                <option key={service.value} value={service.value}>{service.label}</option>
              ))}
            </select>
          </div>
        )}

        {scopeMode === 'name' && (
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Name
            </label>
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              disabled={!selectedTeam}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">
                {selectedTeam ? 'Pilih Name' : 'Pilih Team terlebih dahulu'}
              </option>
              {availableAgentsForTeam.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}{agent.batch_name ? ` - ${agent.batch_name}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={() => handleAddItem(groupId)}
          disabled={addingItem || !canAddScopeItem}
          className="inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-semibold shadow-lg shadow-primary/20 hover:brightness-110 transition-all disabled:cursor-not-allowed disabled:opacity-50 shrink-0"
        >
          {addingItem ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Tambah
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        {scopeMode === 'name'
          ? 'Pilih Team terlebih dahulu untuk menampilkan Name yang tersedia di team tersebut.'
          : 'Dropdown hanya menampilkan data yang tersedia saat halaman dibuka.'}
      </p>
    </div>
  );

  return (
    <>
      <PageHeroHeader
        eyebrow="Admin & Trainer"
        title="Access Groups"
        description="Kelola daftar access group yang digunakan untuk membatasi data leader per modul"
        icon={<Layers className="w-4 h-4" />}
        actions={
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-5 py-2.5 font-bold shadow-lg shadow-primary/20 hover:brightness-110 transition-all"
          >
            <Plus className="w-4 h-4" />
            Group Baru
          </button>
        }
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

      {/* New group form */}
      {showNewForm && (
        <div className="bg-card border border-border rounded-[2rem] p-6 mb-6 shadow-lg">
          <h3 className="text-lg font-bold mb-4">Buat Access Group Baru</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              placeholder="Nama group"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <input
              placeholder="Deskripsi (opsional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCreateGroup}
              disabled={creating || !newName.trim()}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-semibold shadow-lg shadow-primary/20 hover:brightness-110 transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan
            </button>
            <button
              onClick={() => setShowNewForm(false)}
              className="border border-border bg-card rounded-xl px-4 py-2 text-sm font-medium hover:bg-foreground/5 transition-all"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Groups list */}
      <div className="space-y-4">
        {groups.map((group) => (
          <div
            key={group.id}
            className="bg-card border border-border rounded-[2rem] overflow-hidden shadow-lg relative"
          >
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {editingId === group.id ? (
                    <div className="space-y-3">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-xl border border-border bg-card px-4 py-2 text-sm font-bold outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                      />
                      <input
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Deskripsi"
                        className="w-full rounded-xl border border-border bg-card px-4 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateGroup(group.id)}
                          disabled={creating}
                          className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-xl px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          Simpan
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="border border-border rounded-xl px-3 py-1.5 text-xs font-medium"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-bold">{group.name}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] ${
                          group.is_active
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-red-500/10 text-red-600'
                        }`}>
                          {group.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {group.item_count} items
                        </span>
                      </div>
                      {group.description && (
                        <p className="text-sm text-muted-foreground">{group.description}</p>
                      )}
                    </>
                  )}
                </div>

                {/* Actions */}
                {!editingId && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => startEdit(group)}
                      className="p-2 rounded-xl border border-border hover:bg-foreground/5 transition-all"
                    >
                      <Edit2 className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(group.id, group.is_active)}
                      className={`p-2 rounded-xl border transition-all ${
                        group.is_active
                          ? 'border-red-500/20 hover:bg-red-500/10 text-red-500'
                          : 'border-emerald-500/20 hover:bg-emerald-500/10 text-emerald-500'
                      }`}
                    >
                      {group.is_active ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleExpand(group.id)}
                      className="inline-flex items-center gap-1.5 border border-border bg-card rounded-xl px-3 py-1.5 text-xs font-medium hover:bg-foreground/5 transition-all"
                    >
                      <Layers className="w-3 h-3" />
                      {expandedId === group.id ? 'Sembunyikan Items' : 'Lihat Items'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Expanded items */}
            {expandedId === group.id && (
              <div className="border-t border-border px-6 pb-6 pt-4">
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Scope Items
                </h4>

                {loadingItems ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Memuat items...
                  </div>
                ) : (
                  <>
                    {renderAddScopeItemForm(group.id)}

                    {items.length > 0 && (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/50 px-4 py-2"
                          >
                            <div className="flex items-center gap-3">
                              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] bg-primary/10 text-primary">
                                {FIELD_LABELS[item.field_name] || item.field_name}
                              </span>
                              <span className="text-sm font-medium">{getScopeItemDisplayValue(item)}</span>
                            </div>
                            <button
                              onClick={() => handleRemoveItem(item.id, group.id)}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {groups.length === 0 && (
        <div className="bg-card border border-border rounded-[2rem] p-10 text-center">
          <Layers className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Belum ada access group</p>
          <p className="text-sm text-muted-foreground mt-1">Klik tombol Group Baru di atas untuk membuat</p>
        </div>
      )}
    </>
  );
}
