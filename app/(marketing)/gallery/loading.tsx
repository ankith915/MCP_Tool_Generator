export default function GalleryLoading() {
  return (
    <div className="container mx-auto max-w-5xl px-6 py-16">
      <div className="h-8 w-48 rounded bg-muted animate-pulse mb-4" />
      <div className="h-4 w-96 rounded bg-muted animate-pulse mb-12" />
      <div className="grid gap-8">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-border overflow-hidden">
            <div className="h-10 bg-muted/50 border-b border-border" />
            <div className="h-[480px] bg-[#1e1e1e] animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
