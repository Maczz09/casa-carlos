import { z } from "zod";

export const RoleSchema = z.enum(["ADMIN", "RECEPCIONISTA"]);
export type Role = z.infer<typeof RoleSchema>;

export const APP_PERMISSIONS = [
  "BOARD_VIEW",
  "SALES_MANAGE",
  "RESERVATIONS_MANAGE",
  "CASHBOX_MANAGE",
  "INVENTORY_MANAGE",
  "CATEGORIES_MANAGE",
  "ROOMS_MANAGE",
  "BILLING_MANAGE",
  "DASHBOARD_VIEW",
  "REPORTS_EXPORT",
  "NOTIFICATIONS_MANAGE",
  "SETTINGS_MANAGE",
  "USERS_MANAGE",
] as const;

export const AppPermissionSchema = z.enum(APP_PERMISSIONS);
export type AppPermission = z.infer<typeof AppPermissionSchema>;

export const DEFAULT_PERMISSIONS_BY_ROLE: Record<Role, AppPermission[]> = {
  ADMIN: [...APP_PERMISSIONS],
  RECEPCIONISTA: ["BOARD_VIEW", "SALES_MANAGE", "RESERVATIONS_MANAGE", "CASHBOX_MANAGE", "INVENTORY_MANAGE", "BILLING_MANAGE"],
};

export const UserSchema = z.object({
  id: z.string(),
  usuario: z.string().min(3),
  nombres: z.string().min(1),
  apellidos: z.string().min(1),
  rol: RoleSchema,
  permisos: z.array(AppPermissionSchema),
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
