function DashboardLoadingCard() {
  return <div className="h-36 rounded-3xl border border-border/40 bg-card/30 animate-pulse" />;
}

export default function DashboardLoading() {
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-8 xl:p-12 w-full max-w-[1600px] mx-auto space-y-10">
        <div className="space-y-4">
          <div className="h-12 w-56 rounded-2xl bg-card/40 animate-pulse" />
          <div className="h-6 w-full max-w-2xl rounded-2xl bg-card/30 animate-pulse" />
          <div className="h-6 w-full max-w-xl rounded-2xl bg-card/20 animate-pulse" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
          {Array.from({ length: 5 }).map((_, index) => (
            <DashboardLoadingCard key={index} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[420px] rounded-3xl border border-border/40 bg-card/30 animate-pulse" />
          <div className="h-[420px] rounded-3xl border border-border/40 bg-card/30 animate-pulse" />
        </div>
      </div>
    </main>
  );
}
