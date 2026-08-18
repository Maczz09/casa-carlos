import { eq } from "drizzle-orm";
import type { Db } from "@casacarlos/db";
import { schema } from "@casacarlos/db";
import type { User } from "@casacarlos/contracts";

type UserRow = typeof schema.identityUsuarios.$inferSelect;

function toUser(row: UserRow): User {
  return {
    id: row.id,
    usuario: row.usuario,
    nombres: row.nombres,
    apellidos: row.apellidos,
    rol: row.rol,
    telefonoWhatsapp: row.telefonoWhatsapp,
    activo: row.activo,
    creadoEn: row.creadoEn,
  };
}

export class IdentityRepo {
  constructor(private readonly db: Db) {}

  async insertUser(row: UserRow): Promise<User> {
    await this.db.insert(schema.identityUsuarios).values(row);
    return toUser(row);
  }

  async findByUsername(usuario: string): Promise<(UserRow & { user: User }) | null> {
    const row = await this.db.select().from(schema.identityUsuarios).where(eq(schema.identityUsuarios.usuario, usuario)).get();
    return row ? { ...row, user: toUser(row) } : null;
  }

  async findById(id: string): Promise<(UserRow & { user: User }) | null> {
    const row = await this.db.select().from(schema.identityUsuarios).where(eq(schema.identityUsuarios.id, id)).get();
    return row ? { ...row, user: toUser(row) } : null;
  }

  async listActive(): Promise<(UserRow & { user: User })[]> {
    const rows = await this.db.select().from(schema.identityUsuarios).where(eq(schema.identityUsuarios.activo, true)).all();
    return rows.map((row) => ({ ...row, user: toUser(row) }));
  }

  async listAll(): Promise<User[]> {
    const rows = await this.db.select().from(schema.identityUsuarios).all();
    return rows.map(toUser);
  }

  async insertSession(row: typeof schema.identitySesiones.$inferSelect): Promise<void> {
    await this.db.insert(schema.identitySesiones).values(row);
  }

  async findSessionByTokenHash(tokenHash: string) {
    return this.db.select().from(schema.identitySesiones).where(eq(schema.identitySesiones.tokenHash, tokenHash)).get();
  }
}
