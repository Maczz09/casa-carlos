import { BrandAtmosphere } from "@casacarlos/ui";

/**
 * Escena visible aun si el WebGL del equipo está desactivado: la geometría 3D
 * suma profundidad cuando está disponible y las órbitas CSS aseguran una
 * animación legible en el tema claro de las pantallas del kiosco.
 */
export function KioskAmbient() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <BrandAtmosphere className="kiosk-webgl-atmosphere absolute inset-0" />
      <div className="kiosk-orbit kiosk-orbit-one" />
      <div className="kiosk-orbit kiosk-orbit-two" />
      <span className="kiosk-spark kiosk-spark-one" />
      <span className="kiosk-spark kiosk-spark-two" />
      <span className="kiosk-spark kiosk-spark-three" />
    </div>
  );
}
