function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

/** What's on screen until a receptionist starts a session — no call to action, since the guest never initiates. */
export function IdleScreen() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-[#F7F3EA] px-10 text-center">
      <p className="font-serif text-xl italic text-teal-700/70">{greeting()}</p>
      <h1 className="mt-3 font-serif text-6xl text-stone-800">Casa Carlos</h1>
      <div className="mt-8 h-px w-24 bg-stone-300" />
      <p className="mt-8 max-w-md text-lg text-stone-500">Un momento — recepción está preparando tu registro.</p>
    </div>
  );
}
