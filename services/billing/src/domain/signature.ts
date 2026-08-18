import { readFileSync } from "node:fs";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";
import { SIGNATURE_ANCHOR_ID } from "./ubl.js";

export interface CertificateMaterial {
  privateKeyPem: string;
  certificatePem: string;
}

/**
 * Extrae la llave privada y el certificado X.509 de un .pfx/.p12 — el
 * formato en que SUNAT entrega tanto el certificado digital tributario
 * gratuito para MYPE como cualquier certificado comprado a una entidad
 * certificadora.
 */
export function loadPfxCertificate(pfxPath: string, password: string): CertificateMaterial {
  const pfxDer = readFileSync(pfxPath, "binary");
  const p12Asn1 = forge.asn1.fromDer(pfxDer);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

  const keyBagType = forge.pki.oids.pkcs8ShroudedKeyBag!;
  const certBagType = forge.pki.oids.certBag!;
  const keyBagsByType = p12.getBags({ bagType: keyBagType });
  const certBagsByType = p12.getBags({ bagType: certBagType });
  const key = keyBagsByType[keyBagType]?.[0]?.key;
  const cert = certBagsByType[certBagType]?.[0]?.cert;
  if (!key || !cert) {
    throw new Error(`El archivo "${pfxPath}" no contiene una llave privada y un certificado válidos (¿contraseña incorrecta?).`);
  }

  return {
    privateKeyPem: forge.pki.privateKeyToPem(key),
    certificatePem: forge.pki.certificateToPem(cert),
  };
}

const stripPemHeaders = (pem: string): string => pem.replace(/-----[^-]+-----|\r?\n/g, "");

/**
 * Firma el XML UBL con XMLDSig envolvente — el perfil exacto que SUNAT
 * documenta para SEE-Del Contribuyente: canonicalización C14N 1.0, digest
 * SHA1, método de firma RSA-SHA1 (SUNAT sigue exigiendo SHA1, no SHA256,
 * pese a que ya no se considera criptográficamente robusto para uso
 * general). La firma se inserta dentro de `ext:ExtensionContent`, firmando
 * el documento completo (URI vacío + transform enveloped-signature).
 */
export function signInvoiceXml(xml: string, cert: CertificateMaterial): string {
  const sig = new SignedXml({
    privateKey: cert.privateKeyPem,
    publicCert: cert.certificatePem,
    signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
    canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
  });

  sig.addReference({
    xpath: "/*",
    isEmptyUri: true,
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
    transforms: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature", "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"],
  });

  sig.getKeyInfoContent = () => `<ds:X509Data><ds:X509Certificate>${stripPemHeaders(cert.certificatePem)}</ds:X509Certificate></ds:X509Data>`;

  sig.computeSignature(xml, {
    prefix: "ds",
    attrs: { Id: SIGNATURE_ANCHOR_ID },
    location: { reference: "//*[local-name(.)='ExtensionContent']", action: "append" },
  });

  return sig.getSignedXml();
}
