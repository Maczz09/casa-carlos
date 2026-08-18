interface Props {
  title: string;
  subtitle: string;
}

export function WaitingScreen({ title, subtitle }: Props) {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-[#F7F3EA] px-10 text-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-teal-600/20 border-t-teal-600 motion-reduce:animate-none" />
      <h1 className="mt-8 font-serif text-3xl text-stone-800">{title}</h1>
      <p className="mt-3 max-w-sm text-lg text-stone-500">{subtitle}</p>
    </div>
  );
}
