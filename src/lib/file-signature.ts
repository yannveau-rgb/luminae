/**
 * Vérification du type réel d'un fichier par sa signature d'octets.
 *
 * Le contrôle précédent portait sur `file.type`, une valeur fournie par le
 * client : un exécutable renommé en `.pdf` passait sans obstacle (constat
 * S-13). On compare désormais le type déclaré au contenu effectif.
 *
 * Volontairement restreint aux formats de la liste blanche : l'objectif n'est
 * pas de reconnaître tout et n'importe quoi, mais de refuser ce qui ne
 * correspond pas à ce qui est annoncé.
 */

/** Familles de signatures, indexées par type MIME déclaré. */
const SIGNATURES: Record<string, number[][]> = {
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] // GIF89a
  ],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  // Formats Office modernes : archives ZIP.
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    [0x50, 0x4b, 0x03, 0x04],
    [0x50, 0x4b, 0x05, 0x06],
    [0x50, 0x4b, 0x07, 0x08]
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    [0x50, 0x4b, 0x03, 0x04],
    [0x50, 0x4b, 0x05, 0x06],
    [0x50, 0x4b, 0x07, 0x08]
  ],
  // Formats Office historiques : conteneur OLE2.
  'application/msword': [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
  'application/vnd.ms-excel': [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]]
};

/** Types sans signature : validés par l'absence de contenu binaire. */
const TEXTE = new Set(['text/plain', 'text/csv']);

function commencePar(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((octet, i) => bytes[i] === octet);
}

/**
 * WEBP est un conteneur RIFF : « RIFF » puis, quatre octets plus loin, « WEBP ».
 * Le contrôle en deux points évite d'accepter n'importe quel RIFF (AVI, WAV).
 */
function estWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const riff = [0x52, 0x49, 0x46, 0x46];
  const webp = [0x57, 0x45, 0x42, 0x50];
  return riff.every((o, i) => bytes[i] === o) && webp.every((o, i) => bytes[8 + i] === o);
}

/**
 * Un fichier texte ne doit contenir ni octet nul ni caractère de contrôle
 * inattendu. C'est ce qui écarte un binaire renommé en .txt ou .csv.
 */
function estTexte(bytes: Uint8Array): boolean {
  const echantillon = bytes.subarray(0, Math.min(bytes.length, 8192));
  for (const octet of echantillon) {
    if (octet === 0) return false;
    const controleAutorise = octet === 0x09 || octet === 0x0a || octet === 0x0d;
    if (octet < 0x20 && !controleAutorise) return false;
  }
  return true;
}

/**
 * Le contenu correspond-il au type annoncé ?
 * Retourne `null` si tout va bien, sinon un message expliquant le refus.
 */
export function verifierSignature(typeDeclare: string, bytes: Uint8Array): string | null {
  if (bytes.length === 0) return 'Le fichier est vide.';

  if (TEXTE.has(typeDeclare)) {
    return estTexte(bytes) ? null : 'Ce fichier annoncé comme texte contient des données binaires.';
  }

  if (typeDeclare === 'image/webp') {
    return estWebp(bytes) ? null : 'Le contenu ne correspond pas à une image WEBP.';
  }

  const attendues = SIGNATURES[typeDeclare];
  if (!attendues) {
    // Type hors de la liste blanche : l'appelant l'a déjà refusé en amont.
    return 'Type de fichier non reconnu.';
  }

  return attendues.some((sig) => commencePar(bytes, sig))
    ? null
    : 'Le contenu du fichier ne correspond pas au type annoncé.';
}
