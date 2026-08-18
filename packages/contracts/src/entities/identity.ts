import { z } from "zod";

export const RoleSchema = z.enum(["ADMIN", "RECEPCIONISTA"]);
export type Role = z.infer<typeof RoleSchema>;

export const UserSchema = z.object({
  id: z.string(),
  usuario: z.string().min(3),
  nombres: z.string().min(1),
  apellidos: z.string().min(1),
  rol: RoleSchema,
  telefonoWhatsapp: z.string().nullable(),
  activo: z.boolean(),
  creadoEn: z.string(),
});
export type User = z.infer<typeof UserSchema>;

export const SessionSchema = z.object({
  id: z.string(),
  usuarioId: z.string(),
  iniciadaEn: z.string(),
  expiraEn: z.string(),
  cerradaEn: z.string().nullable(),
});
export type Session = z.infer<typeof SessionSchema>;

export const AuthResultSchema = z.object({
  token: z.string(),
  user: UserSchema,
});
export type AuthResult = z.infer<typeof AuthResultSchema>;
