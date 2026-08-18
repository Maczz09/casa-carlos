import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import forge from "node-forge";

/**
 * Genera un certificado autofirmado de un solo uso para probar contra el
 * entorno BETA de SUNAT (que no valida la cadena de confianza — solo la
 * estructura de la firma). NO sirve para producción: ahí se necesita el
 * certificado digital MYPE real que SUNAT entrega gratis vía SOL.
 *
 * Uso: pnpm --filter @casacarlos/billing run gen-test-cert [ruta-salida] [password]
 */
function main() {
  const outPath = process.argv[2] ?? resolve(process.cwd(), "../../data/sunat-beta-test.pfx");
  const password = process.argv[3] ?? "casacarlos";

  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 3);
  const attrs = [
    { name: "commonName", value: "CASA CARLOS BETA TEST" },
    { name: "countryName", value: "PE" },
    { name: "organizationName", value: "HOTELES CASA CARLOS SAC" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: "basicConstraints", cA: false },
    { name: "keyUsage", digitalSignature: true, nonRepudiation: true, keyEncipherment: true, dataEncipherment: true },
    { name: "extKeyUsage", clientAuth: true, emailProtection: true },
    { name: "subjectKeyIdentifier" },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, cert, password, { algorithm: "3des" });
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  writeFileSync(outPath, Buffer.from(p12Der, "binary"));

  console.log(`Certificado de prueba escrito en: ${outPath}`);
  console.log(`Contraseña: ${password}`);
  console.log("Válido solo para SUNAT_MODE=BETA — nunca para PRODUCCION.");
}

main();
