function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

/** What's on screen until a receptionist starts a session — no call to action, since the guest never initiates. */
export function IdleScreen() {
  return (
    <div className="animate-fade flex h-screen flex-col items-center justify-center bg-bg px-10 text-center">
      <p className="animate-fade-up font-serif text-xl italic text-brand/70">{greeting()}</p>
      <h1 className="animate-fade-up mt-3 font-serif text-6xl text-ink" style={{ animationDelay: "80ms" }}>
        Hospedaje Carlos
      </h1>
      <div className="animate-fade-up mt-8 h-px w-24 bg-subtle/50" style={{ animationDelay: "160ms" }} />
      <p className="animate-fade-up mt-8 max-w-md text-lg text-muted" style={{ animationDelay: "220ms" }}>
        Un momento — recepción está preparando tu registro.
      </p>
    </div>
  );
}
