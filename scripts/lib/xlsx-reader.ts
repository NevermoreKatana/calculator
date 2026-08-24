/**
 * Minimal, dependency-free XLSX reader.
 *
 * An .xlsx file is a ZIP archive of XML parts. The npm `xlsx` package would do
 * this too, but its registry builds carry unfixed high-severity advisories
 * (prototype pollution + ReDoS), so this project reads the archive directly
 * with Node's built-in zlib instead. That keeps the dependency surface at zero
 * for a script that only has to understand two sheets of one known workbook.
 *
 * Supports the two things a real .xlsx needs: stored (method 0) and deflated
 * (method 8) entries.
 */
import { inflateRawSync } from 'node:zlib';

interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;

function findEndOfCentralDirectory(buffer: Buffer): number {
  // The EOCD sits at the end, after a comment of at most 65535 bytes.
  const minOffset = Math.max(0, buffer.length - 65535 - 22);
  for (let i = buffer.length - 22; i >= minOffset; i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  throw new Error('Не найден конец центрального каталога ZIP: файл повреждён или не является .xlsx');
}

function readCentralDirectory(buffer: Buffer): Map<string, ZipEntry> {
  const eocd = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  const entries = new Map<string, ZipEntry>();
  for (let i = 0; i < entryCount; i += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
      throw new Error(`Повреждённая запись центрального каталога ZIP по смещению ${offset}`);
    }
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);

    entries.set(name, {
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function extractEntry(buffer: Buffer, entry: ZipEntry): string {
  // The local header repeats the name/extra lengths, which may differ from the
  // central directory's, so the data offset must be computed from it.
  const base = entry.localHeaderOffset;
  const nameLength = buffer.readUInt16LE(base + 26);
  const extraLength = buffer.readUInt16LE(base + 28);
  const dataStart = base + 30 + nameLength + extraLength;
  const raw = buffer.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === 0) return raw.toString('utf8');
  if (entry.compressionMethod === 8) return inflateRawSync(raw).toString('utf8');
  throw new Error(`Неподдерживаемый метод сжатия ZIP: ${entry.compressionMethod}`);
}

export interface XlsxCell {
  /** Cell reference, e.g. "B12". */
  ref: string;
  column: string;
  row: number;
  /** Resolved value: string for shared/inline strings, number for numerics. */
  value: string | number | null;
  /** Raw formula text when present, e.g. "SUM(D5:D29)". */
  formula: string | null;
  /** True when the cached value is an Excel error such as #REF! or #DIV/0!. */
  isError: boolean;
}

export type XlsxSheet = Map<string, XlsxCell>;

const decodeEntities = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&');

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  // Each <si> may hold several <t> runs which concatenate into one string.
  const siPattern = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g;
  let match: RegExpExecArray | null;
  while ((match = siPattern.exec(xml)) !== null) {
    const inner = match[1] ?? '';
    let text = '';
    const tPattern = /<t\b[^>]*>([\s\S]*?)<\/t>|<t\b[^>]*\/>/g;
    let tMatch: RegExpExecArray | null;
    while ((tMatch = tPattern.exec(inner)) !== null) text += tMatch[1] ?? '';
    out.push(decodeEntities(text));
  }
  return out;
}

function parseSheet(xml: string, sharedStrings: string[]): XlsxSheet {
  const cells: XlsxSheet = new Map();
  const cellPattern = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;

  let match: RegExpExecArray | null;
  while ((match = cellPattern.exec(xml)) !== null) {
    const attrs = match[1] ?? '';
    const inner = match[2] ?? '';

    const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
    if (!ref) continue;
    const type = /\bt="([^"]+)"/.exec(attrs)?.[1] ?? 'n';

    const formula = /<f\b[^>]*>([\s\S]*?)<\/f>/.exec(inner)?.[1] ?? null;
    const rawValue = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? null;

    let value: string | number | null = null;
    if (type === 's' && rawValue !== null) {
      value = sharedStrings[Number(rawValue)] ?? null;
    } else if (type === 'inlineStr') {
      const parts: string[] = [];
      const tPattern = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
      let tMatch: RegExpExecArray | null;
      while ((tMatch = tPattern.exec(inner)) !== null) parts.push(tMatch[1]);
      value = decodeEntities(parts.join(''));
    } else if (type === 'str' && rawValue !== null) {
      value = decodeEntities(rawValue);
    } else if (rawValue !== null) {
      const n = Number(rawValue);
      value = Number.isFinite(n) ? n : null;
    }

    const parsed = /^([A-Z]+)(\d+)$/.exec(ref)!;
    cells.set(ref, {
      ref,
      column: parsed[1],
      row: Number(parsed[2]),
      value,
      formula: formula ? decodeEntities(formula) : null,
      isError: type === 'e',
    });
  }
  return cells;
}

export interface XlsxWorkbook {
  sheetNames: string[];
  sheet(name: string): XlsxSheet;
}

export function readWorkbook(buffer: Buffer): XlsxWorkbook {
  const entries = readCentralDirectory(buffer);

  const read = (path: string): string => {
    const entry = entries.get(path);
    if (!entry) throw new Error(`В архиве .xlsx нет части «${path}»`);
    return extractEntry(buffer, entry);
  };

  const sharedStrings = entries.has('xl/sharedStrings.xml')
    ? parseSharedStrings(read('xl/sharedStrings.xml'))
    : [];

  // Map sheet name → target file via workbook.xml + its .rels
  const workbookXml = read('xl/workbook.xml');
  const relsXml = read('xl/_rels/workbook.xml.rels');

  const relTargets = new Map<string, string>();
  const relPattern = /<Relationship\b([^>]*)\/>/g;
  let relMatch: RegExpExecArray | null;
  while ((relMatch = relPattern.exec(relsXml)) !== null) {
    const attrs = relMatch[1];
    const id = /\bId="([^"]+)"/.exec(attrs)?.[1];
    const target = /\bTarget="([^"]+)"/.exec(attrs)?.[1];
    if (id && target) {
      relTargets.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`);
    }
  }

  const sheetPaths = new Map<string, string>();
  const sheetPattern = /<sheet\b([^>]*)\/>/g;
  let sheetMatch: RegExpExecArray | null;
  while ((sheetMatch = sheetPattern.exec(workbookXml)) !== null) {
    const attrs = sheetMatch[1];
    const name = /\bname="([^"]+)"/.exec(attrs)?.[1];
    const rid = /\br:id="([^"]+)"/.exec(attrs)?.[1];
    if (name && rid && relTargets.has(rid)) {
      sheetPaths.set(decodeEntities(name), relTargets.get(rid)!);
    }
  }

  const cache = new Map<string, XlsxSheet>();
  return {
    sheetNames: [...sheetPaths.keys()],
    sheet(name: string): XlsxSheet {
      const cached = cache.get(name);
      if (cached) return cached;
      const path = sheetPaths.get(name);
      if (!path) throw new Error(`В книге нет листа «${name}». Доступны: ${[...sheetPaths.keys()].join(', ')}`);
      const parsed = parseSheet(read(path), sharedStrings);
      cache.set(name, parsed);
      return parsed;
    },
  };
}
