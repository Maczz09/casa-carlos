import type { AuthResult, Role, User } from "../entities/identity.js";

export interface CreateUserInput {
  usuario: string;
  password: string;
  nombres: string;
  apellidos: string;
  rol: Role;
  pin?: string;
  telefonoWhatsapp?: string | null;
}

/** Public surface of `identity`. */
export interface IdentityPort {
  createUser(input: CreateUserInput): Promise<User>;
  listUsers(): Promise<User[]>;

  login(usuario: string, password: string): Promise<AuthResult>;
  switchByPin(pin: string): Promise<AuthResult>;

  getUserByToken(token: string): Promise<User>;
  getUser(id: string): Promise<User>;
}
