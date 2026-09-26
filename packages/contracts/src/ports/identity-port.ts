import type { AppPermission, AuthResult, Role, User } from "../entities/identity.js";

export interface CreateUserInput {
  usuario: string;
  password: string;
  nombres: string;
  apellidos: string;
  rol: Role;
  pin?: string;
  telefonoWhatsapp?: string | null;
  permisos?: AppPermission[];
}

export interface RegisterUserInput {
  usuario: string;
  password: string;
  nombres: string;
  apellidos: string;
  pin?: string;
  telefonoWhatsapp?: string | null;
  adminUsuario?: string;
  adminPassword?: string;
}

export interface UpdateUserInput {
  usuario?: string;
  password?: string;
  nombres?: string;
  apellidos?: string;
  rol?: Role;
  pin?: string | null;
  telefonoWhatsapp?: string | null;
  activo?: boolean;
  permisos?: AppPermission[];
}

/** Public surface of `identity`. */
export interface IdentityPort {
  createUser(input: CreateUserInput): Promise<User>;
  registerUser(input: RegisterUserInput): Promise<User>;
  listUsers(): Promise<User[]>;
  updateUser(id: string, input: UpdateUserInput, actorId: string): Promise<User>;
  deleteUser(id: string, actorId: string): Promise<User>;

  login(usuario: string, password: string): Promise<AuthResult>;
  switchByPin(pin: string): Promise<AuthResult>;

  getUserByToken(token: string): Promise<User>;
  getUser(id: string): Promise<User>;
}
