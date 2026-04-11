export default function AgentDetailLoading() {
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="space-y-6">
        <div className="h-20 border-b border-border/40 bg-card/20 animate-pulse" />
        <div className="h-32 border-b border-border/40 bg-card/20 animate-pulse" />
        <div className="px-6 py-8 space-y-6 max-w-5xl mx-auto">
          <div className="h-16 rounded-2xl bg-card/30 animate-pulse" />
          <div className="h-[420px] rounded-[2.5rem] border border-border/40 bg-card/30 animate-pulse" />
          <div className="h-[320px] rounded-[2.5rem] border border-border/40 bg-card/30 animate-pulse" />
        </div>
      </div>
    </main>
  );
}
