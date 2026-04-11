export default function AgentDirectoryLoading() {
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="p-8 space-y-8">
        <div className="h-24 rounded-3xl border border-border/40 bg-card/30 animate-pulse" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-10 w-28 rounded-full bg-card/30 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-72 rounded-[2rem] border border-border/40 bg-card/30 animate-pulse" />
          ))}
        </div>
      </div>
    </main>
  );
}
