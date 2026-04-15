'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/app/lib/supabase/client';

export default function AccountPage() {
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      setLoadingProfile(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('Sesi login tidak ditemukan. Silakan login ulang.');
        setLoadingProfile(false);
        return;
      }

      setEmail(user.email || '');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (profileError) {
        setError(profileError.message);
      } else {
        setFullName(profile?.full_name || '');
      }

      setLoadingProfile(false);
    }

    void loadUser();
  }, [supabase]);

  async function handleSaveName(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingName(true);
    setNameMessage(null);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError('Sesi login berakhir. Silakan login ulang.');
      setSavingName(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() || null })
      .eq('id', user.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setNameMessage('Nama berhasil diperbarui.');
    }

    setSavingName(false);
  }

  async function handleSavePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordMessage(null);
    setError(null);

    if (newPassword.length < 6) {
      setError('Password minimal 6 karakter.');
      setSavingPassword(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      setSavingPassword(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

    if (updateError) {
      setError(updateError.message);
    } else {
      setPasswordMessage('Password berhasil diperbarui.');
      setNewPassword('');
      setConfirmPassword('');
    }

    setSavingPassword(false);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10 lg:px-10">
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">Akun</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Pengaturan profil</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Kelola nama tampilan dan password akun Anda dari satu halaman.
        </p>
      </header>

      {error && <p className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <section className="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">Profil pengguna</h2>
        <p className="mt-1 text-xs text-muted-foreground">Email login: {loadingProfile ? 'Memuat...' : email || '-'}</p>

        <form onSubmit={handleSaveName} className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Nama tampil</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Masukkan nama"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-0 transition focus:border-primary"
            />
          </label>

          <button
            type="submit"
            disabled={savingName || loadingProfile}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingName ? 'Menyimpan...' : 'Simpan nama'}
          </button>

          {nameMessage && <p className="text-sm text-emerald-600">{nameMessage}</p>}
        </form>
      </section>

      <section className="mt-6 rounded-3xl border border-border/60 bg-card/70 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">Ganti password</h2>
        <p className="mt-1 text-xs text-muted-foreground">Gunakan minimal 6 karakter agar akun tetap aman.</p>

        <form onSubmit={handleSavePassword} className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Password baru</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-0 transition focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Konfirmasi password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none ring-0 transition focus:border-primary"
            />
          </label>

          <button
            type="submit"
            disabled={savingPassword}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingPassword ? 'Menyimpan...' : 'Perbarui password'}
          </button>

          {passwordMessage && <p className="text-sm text-emerald-600">{passwordMessage}</p>}
        </form>
      </section>
    </main>
  );
}
