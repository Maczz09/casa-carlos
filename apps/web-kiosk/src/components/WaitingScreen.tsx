interface Props {
  title: string;
  subtitle: string;
}

export function WaitingScreen({ title, subtitle }: Props) {
  return (
    <div className="animate-fade flex h-screen flex-col items-center justify-center bg-bg px-10 text-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand/20 border-t-brand motion-reduce:animate-none" />
      <h1 className="animate-fade-up mt-8 font-serif text-3xl text-ink">{title}</h1>
      <p className="animate-fade-up mt-3 max-w-sm text-lg text-muted" style={{ animationDelay: "80ms" }}>
        {subtitle}
      </p>
    </div>
  );
}
