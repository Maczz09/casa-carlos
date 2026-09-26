import type { Db } from "@casacarlos/db";
import { DEFAULT_PERMISSIONS_BY_ROLE, newId } from "@casacarlos/contracts";
import type { AuthResult, CreateUserInput, IdentityPort, RegisterUserInput, UpdateUserInput, User } from "@casacarlos/contracts";
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
      permisosJson: JSON.stringify(input.permisos ?? DEFAULT_PERMISSIONS_BY_ROLE[input.rol]),
      telefonoWhatsapp: input.telefonoWhatsapp ?? null,
      activo: true,
      creadoEn: new Date().toISOString(),
    };
    return this.repo.insertUser(row);
  }

  async listUsers(): Promise<User[]> {
    return this.repo.listAll();
  }

  async registerUser(input: RegisterUserInput): Promise<User> {
    const total = await this.repo.countUsers();
    if (total === 0) {
      return this.createUser({ ...input, rol: "ADMIN", permisos: DEFAULT_PERMISSIONS_BY_ROLE.ADMIN });
    }

    const approver = input.adminUsuario ? await this.repo.findByUsername(input.adminUsuario) : null;
    if (!approver || !approver.activo || approver.rol !== "ADMIN" || !input.adminPassword || !verifyPassword(input.adminPassword, approver.passwordHash)) {
      throw new Error("Las credenciales del administrador no son válidas.");
    }
    return this.createUser({
      usuario: input.usuario,
      password: input.password,
      nombres: input.nombres,
      apellidos: input.apellidos,
      pin: input.pin,
      telefonoWhatsapp: input.telefonoWhatsapp,
      rol: "RECEPCIONISTA",
    });
  }

  async updateUser(id: string, input: UpdateUserInput, actorId: string): Promise<User> {
    const found = await this.repo.findById(id);
    if (!found) throw new Error(`Usuario ${id} no encontrado.`);
    if (id === actorId && input.activo === false) throw new Error("No podés desactivar tu propia cuenta mientras la estás usando.");

    const removesAdmin = found.rol === "ADMIN" && found.activo && (input.rol === "RECEPCIONISTA" || input.activo === false);
    if (removesAdmin && (await this.repo.countActiveAdmins()) <= 1) {
      throw new Error("Debe quedar al menos un administrador activo.");
    }

    if (input.usuario && input.usuario !== found.usuario) {
      const duplicate = await this.repo.findByUsername(input.usuario);
      if (duplicate) throw new Error(`El usuario "${input.usuario}" ya existe.`);
    }

    const nextRole = input.rol ?? found.rol;
    const patch: Partial<typeof found> = {};
    if (input.usuario !== undefined) patch.usuario = input.usuario;
    if (input.nombres !== undefined) patch.nombres = input.nombres;
    if (input.apellidos !== undefined) patch.apellidos = input.apellidos;
    if (input.rol !== undefined) patch.rol = input.rol;
    if (input.telefonoWhatsapp !== undefined) patch.telefonoWhatsapp = input.telefonoWhatsapp;
    if (input.activo !== undefined) patch.activo = input.activo;
    if (input.password) patch.passwordHash = hashPassword(input.password);
    if (input.pin !== undefined) patch.pinHash = input.pin ? hashPin(input.pin) : null;
    if (input.permisos !== undefined) patch.permisosJson = JSON.stringify(input.permisos);
    else if (input.rol !== undefined && input.rol !== found.rol) patch.permisosJson = JSON.stringify(DEFAULT_PERMISSIONS_BY_ROLE[nextRole]);
    return this.repo.updateUser(id, patch);
  }

  async deleteUser(id: string, actorId: string): Promise<User> {
    return this.updateUser(id, { activo: false }, actorId);
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
