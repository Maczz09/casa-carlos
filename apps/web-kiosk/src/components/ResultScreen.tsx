interface Props {
  accepted: boolean;
  roomNumber?: string;
  hotel: string;
}

export function ResultScreen({ accepted, roomNumber, hotel }: Props) {
  return (
    <div className="animate-fade flex h-screen flex-col items-center justify-center bg-bg px-10 text-center">
      <div
        className={`animate-pop flex h-20 w-20 items-center justify-center rounded-full text-4xl ${
          accepted ? "bg-brand-soft text-brand" : "bg-danger/10 text-danger"
        }`}
      >
        {accepted ? "✓" : "✕"}
      </div>
      <h1 className="animate-fade-up mt-6 font-serif text-4xl text-ink" style={{ animationDelay: "80ms" }}>
        {accepted ? `¡Bienvenido a ${hotel}!` : "No pudimos confirmar el pago"}
      </h1>
      <p className="animate-fade-up mt-3 max-w-sm text-lg text-muted" style={{ animationDelay: "160ms" }}>
        {accepted ? `Tu cuarto ${roomNumber ?? ""} está listo. Recepción te entregará la llave.` : "Por favor conversa con el recepcionista para intentarlo de nuevo."}
      </p>
    </div>
  );
}
