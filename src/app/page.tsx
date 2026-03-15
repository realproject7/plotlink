export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <main className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-accent text-2xl font-bold tracking-tight">
          PlotLink
        </h1>
        <p className="text-muted max-w-md text-sm leading-relaxed">
          Collaborative on-chain storytelling. Write the next chapter.
        </p>
        <div className="border-border rounded border px-4 py-2 text-xs text-muted">
          <span className="text-accent-dim">$</span> npm run dev
        </div>
      </main>
    </div>
  );
}
