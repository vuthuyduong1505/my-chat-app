function AuthCard({ title, subtitle, children }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-accent p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(0,191,165,0.15),transparent_45%),radial-gradient(ellipse_at_80%_100%,rgba(0,59,68,0.08),transparent_40%)]" />
      <div className="relative w-full max-w-md rounded-2xl border border-primary/10 bg-light p-8 shadow-soft ring-1 ring-primary/5">
        <div className="mb-1 inline-flex rounded-full bg-secondary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-secondary">
          D-Chat
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-primary">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm leading-relaxed text-primary/55">{subtitle}</p> : null}
        {children}
      </div>
    </main>
  );
}

export default AuthCard;
