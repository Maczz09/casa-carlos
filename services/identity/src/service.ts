import type { Db } from "@casacarlos/db";
import { newId } from "@casacarlos/contracts";
import type { AuthResult, CreateUserInput, IdentityPort, User } from "@casacarlos/contracts";
import { IdentityRepo } from "./repo.js";
import { hashPassword, hashPin, hashToken, newToken, verifyPassword, verifyPin } from "./crypto.js";

const SESSION_HOURS = 12;

export class IdentityService implements IdentityPort {
  private readonly repo: IdentityRepo;

  constructor(db: Db) {
    this.repo = new IdentityRepo(db);
  }

  async createUser(input: CreateUserInput): Promise<User> {
    if (await this.repo.findByUsername(input.usuario)) {
      throw new Error(`El usuario "${input.usuario}" ya existe.`);
    }
    const row = {
      id: newId(),
      usuario: input.usuario,
      nombres: input.nombres,
      apellidos: input.apellidos,
      passwordHash: hashPassword(input.password),
      pinHash: input.pin ? hashPin(input.pin) : null,
      rol: input.rol,
      telefonoWhatsapp: input.telefonoWhatsapp ?? null,
      activo: true,
      creadoEn: new Date().toISOString(),
    };
    return this.repo.insertUser(row);
  }

  async listUsers(): Promise<User[]> {
    return this.repo.listAll();
  }

  async login(usuario: string, password: string): Promise<AuthResult> {
    const found = await this.repo.findByUsername(usuario);
    if (!found || !found.activo || !verifyPassword(password, found.passwordHash)) {
      throw new Error("Usuario o contraseña incorrectos.");
    }
    return this.issueSession(found.user);
  }

  async switchByPin(pin: string): Promise<AuthResult> {
    const active = await this.repo.listActive();
    const match = active.find((row) => row.pinHash && verifyPin(pin, row.pinHash));
    if (!match) {
      throw new Error("PIN incorrecto.");
    }
    return this.issueSession(match.user);
  }

  async getUserByToken(token: string): Promise<User> {
    const session = await this.repo.findSessionByTokenHash(hashToken(token));
    if (!session || session.cerradaEn || new Date(session.expiraEn) < new Date()) {
      throw new Error("Sesión inválida o expirada.");
    }
    const found = await this.repo.findById(session.usuarioId);
    if (!found || !found.activo) throw new Error("Usuario inactivo.");
    return found.user;
  }

  async getUser(id: string): Promise<User> {
    const found = await this.repo.findById(id);
    if (!found) throw new Error(`Usuario ${id} no encontrado.`);
    return found.user;
  }

  private async issueSession(user: User): Promise<AuthResult> {
    const token = newToken();
    const now = new Date();
    const expira = new Date(now.getTime() + SESSION_HOURS * 60 * 60 * 1000);
    await this.repo.insertSession({
      id: newId(),
      usuarioId: user.id,
      tokenHash: hashToken(token),
      iniciadaEn: now.toISOString(),
      expiraEn: expira.toISOString(),
      cerradaEn: null,
    });
    return { token, user };
  }
}
