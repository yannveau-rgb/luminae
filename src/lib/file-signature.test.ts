import { verifierSignature } from './file-signature.ts';

/** Construit un contenu à partir d'octets d'en-tête puis de remplissage. */
function fichier(entete: number[], suite = 'contenu quelconque'): Uint8Array {
  const corps = new TextEncoder().encode(suite);
  const out = new Uint8Array(entete.length + corps.length);
  out.set(entete, 0);
  out.set(corps, entete.length);
  return out;
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const PDF = [0x25, 0x50, 0x44, 0x46];
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const GIF89 = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
// MZ : en-tête d'un exécutable Windows.
const EXE = [0x4d, 0x5a, 0x90, 0x00];
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

interface Cas {
  nom: string;
  type: string;
  bytes: Uint8Array;
  /** true = doit être accepté */
  accepte: boolean;
}

function webp(): Uint8Array {
  const b = new Uint8Array(20);
  b.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  b.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  return b;
}

function riffAudio(): Uint8Array {
  const b = new Uint8Array(20);
  b.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  b.set([0x57, 0x41, 0x56, 0x45], 8); // WAVE — pas une image
  return b;
}

const cas: Cas[] = [
  // ── Contenus conformes ────────────────────────────────────────────────
  { nom: 'png valide', type: 'image/png', bytes: fichier(PNG), accepte: true },
  { nom: 'jpeg valide', type: 'image/jpeg', bytes: fichier(JPEG), accepte: true },
  { nom: 'gif valide', type: 'image/gif', bytes: fichier(GIF89), accepte: true },
  { nom: 'webp valide', type: 'image/webp', bytes: webp(), accepte: true },
  { nom: 'pdf valide', type: 'application/pdf', bytes: fichier(PDF), accepte: true },
  { nom: 'docx (zip) valide', type: DOCX, bytes: fichier(ZIP), accepte: true },
  { nom: 'doc (ole) valide', type: 'application/msword', bytes: fichier(OLE), accepte: true },
  { nom: 'texte simple', type: 'text/plain', bytes: new TextEncoder().encode('bonjour\nligne 2\t;'), accepte: true },
  { nom: 'csv avec accents', type: 'text/csv', bytes: new TextEncoder().encode('nom;prénom\nDupont;Léa'), accepte: true },

  // ── Le cœur du constat S-13 : contenu qui ne correspond pas ───────────
  { nom: 'exe renomme en pdf', type: 'application/pdf', bytes: fichier(EXE), accepte: false },
  { nom: 'exe renomme en png', type: 'image/png', bytes: fichier(EXE), accepte: false },
  { nom: 'exe renomme en txt', type: 'text/plain', bytes: fichier(EXE), accepte: false },
  { nom: 'pdf annonce comme png', type: 'image/png', bytes: fichier(PDF), accepte: false },
  { nom: 'zip annonce comme pdf', type: 'application/pdf', bytes: fichier(ZIP), accepte: false },
  { nom: 'wave annonce comme webp', type: 'image/webp', bytes: riffAudio(), accepte: false },
  { nom: 'binaire avec octet nul en csv', type: 'text/csv', bytes: new Uint8Array([0x61, 0x00, 0x62]), accepte: false },
  { nom: 'fichier vide', type: 'image/png', bytes: new Uint8Array(0), accepte: false },
  { nom: 'type hors liste blanche', type: 'application/x-msdownload', bytes: fichier(EXE), accepte: false },
  { nom: 'png tronque avant la fin de signature', type: 'image/png', bytes: new Uint8Array(PNG.slice(0, 4)), accepte: false }
];

let echecs = 0;
for (const c of cas) {
  const refus = verifierSignature(c.type, c.bytes);
  const accepte = refus === null;
  if (accepte !== c.accepte) {
    echecs++;
    console.log(`ECHEC  ${c.nom}`);
    console.log(`       attendu : ${c.accepte ? 'accepte' : 'refuse'} — obtenu : ${accepte ? 'accepte' : `refuse (${refus})`}`);
  } else {
    console.log(`ok     ${c.nom}`);
  }
}

console.log(`\n${cas.length - echecs}/${cas.length} cas passent.`);
if (echecs > 0) process.exitCode = 1;
