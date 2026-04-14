import { GraduationCap, IdCard, Mail, Phone, Shield, Sparkles, Users } from 'lucide-react';

const participant = {
  name: 'Nadya Pramesti',
  role: 'Team Leader',
  team: 'Telepon',
  batch: 'Batch Mei 2025',
  tenure: '2 tahun 4 bulan',
  age: '29 tahun',
  gender: 'Perempuan',
  education: 'S1 Ilmu Komunikasi',
  email: 'nadya.pramesti@ojk.go.id',
  phone: '0812-7788-9900',
  start: '14 Mei 2023',
  religion: 'Islam',
  marital: 'Menikah',
  school: 'Universitas Padjadjaran',
  major: 'Komunikasi',
  previousCompany: 'PT Telekomunikasi Indonesia',
  experience: 'Pernah',
  notes: 'Mentor onboarding terbaik Q4 2025. Kuat di coaching percakapan sulit dan pemetaan gap quality.',
};

export default function ProfilerSlidesPreviewPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-[-10%] top-[-8%] h-[30rem] w-[30rem] rounded-full bg-module-profiler/12 blur-[140px]" />
        <div className="absolute right-[-8%] top-[10%] h-[28rem] w-[28rem] rounded-full bg-primary/8 blur-[140px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1800px] px-6 py-8 lg:px-10 lg:py-10">
        <header className="mb-8 rounded-[2rem] border border-border/50 bg-card/75 p-7 shadow-xl shadow-black/5 backdrop-blur-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-module-profiler/20 bg-module-profiler/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-module-profiler">
                <Sparkles className="h-3.5 w-3.5" />
                Profiler Slides Preview
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-semibold tracking-tight lg:text-5xl">Dua arah visual untuk slide peserta.</h1>
                <p className="max-w-3xl text-base leading-7 text-muted-foreground lg:text-lg">
                  Kiri adalah versi konservatif yang aman dan dekat dengan flow operasional saat ini. Kanan adalah versi polished
                  yang lebih presentasional dan menonjolkan identitas peserta lebih kuat.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <MetaCard label="Arah 1" value="Konservatif" />
              <MetaCard label="Arah 2" value="Polished" />
            </div>
          </div>
        </header>

        <section className="space-y-8">
          <article className="rounded-[2rem] border border-border/50 bg-card/80 p-5 shadow-lg shadow-black/5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Opsi 1</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Konservatif</h2>
              </div>
              <div className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                Stabil untuk operasional
              </div>
            </div>
            <ConservativeSlide />
          </article>

          <article className="rounded-[2rem] border border-border/50 bg-card/80 p-5 shadow-lg shadow-black/5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Opsi 2</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Polished</h2>
              </div>
              <div className="rounded-full border border-module-profiler/20 bg-module-profiler/10 px-3 py-1 text-[11px] font-semibold text-module-profiler">
                Lebih presentasional
              </div>
            </div>
            <PolishedSlide />
          </article>
        </section>
      </div>
    </main>
  );
}

function ConservativeSlide() {
  return (
    <div className="mx-auto aspect-[16/9] w-full max-w-[1600px] overflow-hidden rounded-[1.75rem] border border-border/60 bg-background shadow-inner">
      <div className="h-2 bg-primary" />
      <div className="grid h-[calc(100%-0.5rem)] grid-cols-[300px_1fr]">
        <aside className="border-r border-border/60 bg-muted/35 p-7">
          <AvatarPanel compact />
          <div className="mt-6 rounded-2xl border border-border/60 bg-card/85 p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Ringkasan</p>
            <div className="mt-4 space-y-4 text-base">
              <SummaryRow label="Masa dinas" value={participant.tenure} />
              <SummaryRow label="Usia" value={participant.age} />
              <SummaryRow label="Status" value={participant.marital} />
              <SummaryRow label="Agama" value={participant.religion} />
            </div>
          </div>
        </aside>

        <div className="grid gap-4 p-7">
          <Section title="Data Kerja">
            <FieldGrid
              items={[
                ['Email OJK', participant.email],
                ['No. Telepon', participant.phone],
                ['Bergabung', participant.start],
                ['Tim', participant.team],
                ['Batch', participant.batch],
                ['Pengalaman CC', participant.experience],
              ]}
            />
          </Section>

          <Section title="Data Pribadi">
            <FieldGrid
              items={[
                ['Gender', participant.gender],
                ['Pendidikan', participant.education],
                ['Agama', participant.religion],
                ['Status', participant.marital],
              ]}
            />
          </Section>

          <Section title="Latar Belakang">
            <FieldGrid
              items={[
                ['Lembaga', participant.school],
                ['Jurusan', participant.major],
                ['Previous Company', participant.previousCompany],
              ]}
            />
          </Section>

          <Section title="Catatan">
            <p className="text-sm leading-6 text-foreground/80">{participant.notes}</p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function PolishedSlide() {
  return (
    <div className="mx-auto aspect-[16/9] w-full max-w-[1600px] overflow-hidden rounded-[1.75rem] border border-module-profiler/15 bg-[linear-gradient(135deg,#faf7ff_0%,#ffffff_45%,#eef4ff_100%)] shadow-inner dark:bg-[linear-gradient(135deg,#171120_0%,#111827_45%,#131a2d_100%)]">
      <div className="relative h-full overflow-hidden p-7">
        <div className="absolute left-[-8%] top-[-12%] h-48 w-48 rounded-full bg-module-profiler/20 blur-[90px]" />
        <div className="absolute bottom-[-18%] right-[-8%] h-56 w-56 rounded-full bg-primary/10 blur-[100px]" />

        <div className="relative z-10 grid h-full grid-cols-[320px_1fr] gap-6">
          <aside className="rounded-[1.5rem] border border-white/40 bg-white/70 p-6 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <AvatarPanel />
            <div className="mt-6 grid gap-4">
              <BadgeStat icon={<Users className="h-4 w-4" />} label="Tim" value={participant.team} />
              <BadgeStat icon={<IdCard className="h-4 w-4" />} label="Batch" value={participant.batch} />
              <BadgeStat icon={<Shield className="h-4 w-4" />} label="Masa dinas" value={participant.tenure} />
            </div>
          </aside>

          <div className="grid gap-5">
            <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[1.5rem] border border-white/40 bg-white/75 p-6 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-module-profiler">Professional snapshot</p>
                <h3 className="mt-4 text-2xl font-semibold tracking-tight">Identitas utama dan kontak kerja</h3>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <InfoTile icon={<Mail className="h-4 w-4" />} label="Email OJK" value={participant.email} />
                  <InfoTile icon={<Phone className="h-4 w-4" />} label="No. Telepon" value={participant.phone} />
                  <InfoTile icon={<Users className="h-4 w-4" />} label="Gender" value={participant.gender} />
                  <InfoTile icon={<GraduationCap className="h-4 w-4" />} label="Pendidikan" value={participant.education} />
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-module-profiler/15 bg-module-profiler/10 p-6 shadow-lg">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-module-profiler">Key highlight</p>
                <h3 className="mt-4 text-2xl font-semibold tracking-tight">Kekuatan utama</h3>
                <p className="mt-4 text-base leading-7 text-foreground/80">
                  Mentor onboarding yang kuat di area coaching percakapan sulit, dengan reputasi sangat baik untuk quality guidance dan
                  pembentukan ritme tim.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {['Coaching', 'Quality', 'Onboarding', 'Leadership'].map((item) => (
                    <span key={item} className="rounded-full border border-module-profiler/20 bg-white/70 px-3 py-1 text-[11px] font-semibold text-module-profiler dark:bg-white/10">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[1.5rem] border border-white/40 bg-white/75 p-6 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Background</p>
                <div className="mt-4 space-y-5">
                  <MiniFact label="Lembaga" value={participant.school} />
                  <MiniFact label="Jurusan" value={participant.major} />
                  <MiniFact label="Previous company" value={participant.previousCompany} />
                  <MiniFact label="Agama / status" value={`${participant.religion} / ${participant.marital}`} />
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-white/40 bg-white/75 p-6 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Notes for leadership</p>
                <p className="mt-4 text-base leading-7 text-foreground/85">{participant.notes}</p>
                <div className="mt-5 rounded-2xl border border-border/60 bg-background/70 p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Use case</p>
                  <p className="mt-2 text-sm leading-6 text-foreground/80">
                    Cocok dipakai untuk briefing cepat, presentasi batch, atau review profil peserta dengan fokus lebih kuat ke identitas dan kekuatan utama.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function AvatarPanel({ compact = false }: { compact?: boolean }) {
  return (
    <div className="text-center">
      <div className={`mx-auto flex items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-module-profiler/20 via-primary/10 to-background shadow-inner ${compact ? 'h-36 w-36' : 'h-40 w-40'}`}>
        <div className="flex h-[88%] w-[88%] items-center justify-center rounded-[1.25rem] border border-white/50 bg-card/85 text-4xl font-semibold text-module-profiler">
          NP
        </div>
      </div>
      <h3 className="mt-5 text-3xl font-semibold tracking-tight">{participant.name}</h3>
      <p className="mt-2 text-base font-medium text-module-profiler">{participant.role}</p>
      <p className="mt-3 text-[12px] uppercase tracking-[0.22em] text-muted-foreground">{participant.team}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/85 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">{title}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function FieldGrid({ items }: { items: string[][] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label}>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-base font-medium text-foreground/85">{value}</p>
        </div>
      ))}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-base font-semibold text-foreground">{value}</span>
    </div>
  );
}

function BadgeStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/40 bg-white/75 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center gap-2 text-module-profiler">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-[0.22em]">{label}</span>
      </div>
      <p className="mt-2 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-[0.22em]">{label}</span>
      </div>
      <p className="mt-2 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-border/60 bg-background/70 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
