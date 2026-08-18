interface Props {
  accepted: boolean;
  roomNumber?: string;
}

export function ResultScreen({ accepted, roomNumber }: Props) {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-[#F7F3EA] px-10 text-center">
      <div
        className={`flex h-20 w-20 items-center justify-center rounded-full text-4xl ${accepted ? "bg-teal-100 text-teal-700" : "bg-rose-100 text-rose-700"}`}
      >
        {accepted ? "✓" : "✕"}
      </div>
      <h1 className="mt-6 font-serif text-4xl text-stone-800">{accepted ? "¡Bienvenido a Casa Carlos!" : "No pudimos confirmar el pago"}</h1>
      <p className="mt-3 max-w-sm text-lg text-stone-500">
        {accepted ? `Tu cuarto ${roomNumber ?? ""} está listo. Recepción te entregará la llave.` : "Por favor conversa con el recepcionista para intentarlo de nuevo."}
      </p>
    </div>
  );
}
