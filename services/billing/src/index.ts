import type { Db } from "@casacarlos/db";
import type { BillingPort, SalesPort } from "@casacarlos/contracts";
import type { EmisorInfo } from "./domain/ubl.js";
import type { CertificateMaterial } from "./domain/signature.js";
import type { SunatClient } from "./sunat/types.js";
import { BillingRepo } from "./repo.js";
import { BillingService } from "./service.js";

export function createBillingService(db: Db, sales: SalesPort, sunatClient: SunatClient, emisor: EmisorInfo, cert: CertificateMaterial | null): BillingPort {
  return new BillingService(new BillingRepo(db), sales, sunatClient, emisor, cert);
}

/** Debe correr una vez al arrancar el servidor, antes de aceptar requests — ver `BillingRepo.ensureAllCorrelativosSeeded`. */
export async function ensureBillingCorrelativosSeeded(db: Db): Promise<void> {
  await new BillingRepo(db).ensureAllCorrelativosSeeded();
}

export type { EmisorInfo, ReceptorInfo } from "./domain/ubl.js";
export type { CertificateMaterial } from "./domain/signature.js";
export { loadPfxCertificate, inspectPfxCertificate, type CertificateInfo } from "./domain/signature.js";
export type { SunatClient } from "./sunat/types.js";
export { MockSunatClient } from "./sunat/mock-client.js";
export { RealSunatClient, type RealSunatClientConfig } from "./sunat/real-client.js";
export type { BillingPort } from "@casacarlos/contracts";
