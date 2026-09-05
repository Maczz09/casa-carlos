import type { FastifyInstance } from "fastify";
import type { Services } from "../index.js";
import { requireAdmin } from "../auth.js";
import { probeSunatCredentials, type UpdateSunatConfigInput } from "../sunat-config.js";

/**
 * Configuración de facturación electrónica, editable sin reinstalar ni tocar
 * archivos: es la salida para cuando algo se cargó mal en la instalación
 * (modo equivocado, RUC con un dígito de más, certificado vencido).
 *
 * Todo acá es solo para administradores, y ninguna respuesta devuelve la clave
 * SOL ni la contraseña del certificado — solo si están cargadas o no.
 */
export function sunatRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    const admin = { preHandler: requireAdmin(services.identity) };

    app.get("/api/sunat/config", admin, async () => services.sunatConfig.read(services.sunatModoActivo));

    app.patch<{ Body: UpdateSunatConfigInput }>("/api/sunat/config", admin, async (request, reply) => {
      try {
        services.sunatConfig.save(request.body ?? {}, services.applySunatConfig);
        return services.sunatConfig.read(services.sunatModoActivo);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    // El .pfx viaja con su contraseña en el mismo formulario: sin la
    // contraseña no se puede verificar que el archivo sirva, y guardarlo sin
    // verificar es exactamente el error que deja la facturación caída.
    app.post("/api/sunat/certificate", admin, async (request, reply) => {
      try {
        const part = await request.file();
        if (!part) return reply.code(400).send({ error: "Elegí el archivo .pfx del certificado." });
        const campo = part.fields["password"];
        const password = campo && !Array.isArray(campo) && "value" in campo ? String(campo.value ?? "") : "";
        services.sunatConfig.saveCertificate(await part.toBuffer(), password, services.applySunatConfig);
        return services.sunatConfig.read(services.sunatModoActivo);
      } catch (err) {
        const mensaje = (err as Error).message;
        return reply.code(mensaje.includes("File too large") ? 413 : 400).send({ error: mensaje });
      }
    });

    app.post("/api/sunat/test", admin, async () => probeSunatCredentials(services.sunatConfig.current()));
  };
}
