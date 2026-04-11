export default function QaDashboardLoading() {
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-8 lg:p-12 w-full max-w-[1600px] mx-auto space-y-8">
        <div className="space-y-4">
          <div className="h-8 w-44 rounded-xl bg-card/30 animate-pulse" />
          <div className="h-14 w-80 rounded-2xl bg-card/40 animate-pulse" />
          <div className="h-6 w-full max-w-2xl rounded-xl bg-card/20 animate-pulse" />
        </div>

        <div className="h-16 rounded-2xl border border-border/40 bg-card/30 animate-pulse" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-40 rounded-2xl border border-border/40 bg-card/30 animate-pulse" />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="h-[340px] rounded-2xl border border-border/40 bg-card/30 animate-pulse" />
          <div className="h-[340px] rounded-2xl border border-border/40 bg-card/30 animate-pulse" />
        </div>
      </div>
    </main>
  );
}
