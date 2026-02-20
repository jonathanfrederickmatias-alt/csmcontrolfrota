export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar border-b border-sidebar-border px-4 py-3 flex items-center gap-3">
        <h1 className="text-lg font-black">
          <span className="text-gradient">CSM</span>
          <span className="text-sidebar-foreground">CONTROL</span>
        </h1>
        <span className="text-xs text-muted-foreground">Acesso via QR Code</span>
      </div>
      <div className="p-4 max-w-lg mx-auto mt-4">
        {children}
      </div>
    </div>
  );
}
