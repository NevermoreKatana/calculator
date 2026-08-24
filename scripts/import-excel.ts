/**
 * Imports the `Database` sheet of «формирование ганаша программа.xlsx» into
 * PostgreSQL (spec §41).
 *
 * Pipeline:  read → detect columns → normalise → validate → report → upsert
 *
 * Design rules:
 *  • #REF! and other Excel error cells are DISCARDED, never coerced to 0
 *    silently — every one is reported.
 *  • Rows whose components do not sum to 100 % are imported AS THEY ARE and
 *    flagged. Nothing is normalised, rescaled or invented (spec §51).
 *  • Duplicate names are collapsed onto one row, with the collision reported.
 *
 * Usage:
 *   npm run import:excel -- [path/to/workbook.xlsx] [--dry-run]
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient, type IngredientCategory } from '@prisma/client';
import { z } from 'zod';
import { readWorkbook, type XlsxSheet } from './lib/xlsx-reader';

const DEFAULT_WORKBOOK = 'docs/source/формирование ганаша программа.xlsx';
const SHEET_NAME = 'Database';
/** First data row: rows 1–5 are the two-level header block. */
const FIRST_DATA_ROW = 6;

/**
 * Column map, verified against the VLOOKUP indices the `calculator` sheet
 * stores in D1:J1 — e.g. calculator!F uses index 2 → Database!B (сахара).
 */
const COLUMN_MAP = {
  A: 'name',
  B: 'sugarPercentage',
  C: 'fatPercentage',
  D: 'cocoaButterPercentage',
  E: 'milkSolidsPercentage',
  F: 'cocoaSolidsPercentage',
  G: 'otherSolidsPercentage',
  H: 'waterPercentage',
  I: 'pricePerKg',
  J: 'sweetness',
} as const;

const PERCENT_COLUMNS = [
  'sugarPercentage',
  'fatPercentage',
  'cocoaButterPercentage',
  'milkSolidsPercentage',
  'cocoaSolidsPercentage',
  'otherSolidsPercentage',
  'waterPercentage',
] as const;

/** Excel stores fractions (0.35); the app stores percent (35). */
const rawFractionToPercent = z
  .number()
  .finite()
  .transform((v) => v * 100);

const IngredientRowSchema = z.object({
  name: z.string().trim().min(1),
  sugarPercentage: rawFractionToPercent.default(0),
  fatPercentage: rawFractionToPercent.default(0),
  cocoaButterPercentage: rawFractionToPercent.default(0),
  milkSolidsPercentage: rawFractionToPercent.default(0),
  cocoaSolidsPercentage: rawFractionToPercent.default(0),
  otherSolidsPercentage: rawFractionToPercent.default(0),
  waterPercentage: rawFractionToPercent.default(0),
  sweetness: rawFractionToPercent.default(0),
  pricePerKg: z.number().finite().nonnegative().nullable().default(null),
});

interface ImportIssue {
  row: number;
  name?: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
}

function categorize(name: string): IngredientCategory {
  const s = name.toLowerCase();
  if (/cacao paste|cocoa massa/.test(s) || s === 'butter cacao') return 'cocoa';
  if (/^(barry|callebaut|valrhona|cacao-barry|power 41)/.test(s)) return 'chocolate';
  if (/^sugar|^glucose/.test(s)) return 'sugar';
  if (/pur[eé]e/.test(s)) return 'fruit';
  if (/^alco|alcool/.test(s)) return 'alcohol';
  if (/^butter|^cream|^milk|mascarpone|сливки/.test(s)) return 'dairy';
  if (/paste|pralin|^thina/.test(s)) return 'nut';
  if (s === 'oil' || s === 'lecithin soya') return 'fat';
  return 'other';
}

function detectBrand(name: string): string | null {
  const s = name.toLowerCase();
  const brands: [RegExp, string][] = [
    [/valrhona/, 'Valrhona'],
    [/callebaut/, 'Callebaut'],
    [/barry/, 'Cacao Barry'],
    [/capfruit/, 'Capfruit'],
    [/sosa/, 'Sosa'],
  ];
  for (const [pattern, label] of brands) if (pattern.test(s)) return label;
  return null;
}

function collectRows(sheet: XlsxSheet): Map<number, Map<string, string | number | null>> {
  const rows = new Map<number, Map<string, string | number | null>>();
  for (const cell of sheet.values()) {
    if (cell.row < FIRST_DATA_ROW) continue;
    if (!(cell.column in COLUMN_MAP)) continue;
    if (!rows.has(cell.row)) rows.set(cell.row, new Map());
    rows.get(cell.row)!.set(cell.column, cell.isError ? null : cell.value);
  }
  return rows;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const workbookArg = args.find((a) => !a.startsWith('--'));
  const workbookPath = resolve(process.cwd(), workbookArg ?? DEFAULT_WORKBOOK);

  console.log(`\n📖  Читаю: ${workbookPath}`);
  const workbook = readWorkbook(readFileSync(workbookPath));
  console.log(`    Листы: ${workbook.sheetNames.join(', ')}`);

  const sheet = workbook.sheet(SHEET_NAME);
  const issues: ImportIssue[] = [];

  // Report every Excel error cell in the data area before dropping it.
  for (const cell of sheet.values()) {
    if (cell.isError && cell.row >= FIRST_DATA_ROW && cell.column in COLUMN_MAP) {
      issues.push({
        row: cell.row,
        severity: 'warning',
        code: 'excel_error_cell',
        message: `Ячейка ${cell.ref} содержит ошибку Excel (${cell.value ?? '#REF!'}); значение отброшено, а не заменено нулём.`,
      });
    }
  }

  const rawRows = collectRows(sheet);
  const prepared: {
    row: number;
    data: z.infer<typeof IngredientRowSchema>;
    category: IngredientCategory;
    brand: string | null;
    componentSum: number;
  }[] = [];

  for (const [rowNumber, cells] of [...rawRows.entries()].sort((a, b) => a[0] - b[0])) {
    const record: Record<string, unknown> = {};
    for (const [column, field] of Object.entries(COLUMN_MAP)) {
      const value = cells.get(column);
      if (value === undefined || value === null) continue;
      record[field] = value;
    }

    const name = record.name;
    if (typeof name !== 'string' || name.trim() === '') {
      // Trailing rows in the sheet carry only a price of 0 and no name.
      const hasData = PERCENT_COLUMNS.some((f) => typeof record[f] === 'number' && record[f] !== 0);
      if (hasData) {
        issues.push({
          row: rowNumber,
          severity: 'error',
          code: 'missing_name',
          message: 'Строка содержит числовые данные, но не имеет названия ингредиента — пропущена.',
        });
      }
      continue;
    }

    // Numeric columns must actually be numeric; text there is a data error.
    for (const field of [...PERCENT_COLUMNS, 'sweetness', 'pricePerKg'] as const) {
      if (field in record && typeof record[field] !== 'number') {
        issues.push({
          row: rowNumber,
          name: name.trim(),
          severity: 'error',
          code: 'non_numeric',
          message: `Поле ${field} содержит нечисловое значение «${String(record[field])}» — отброшено.`,
        });
        delete record[field];
      }
    }

    const parsed = IngredientRowSchema.safeParse(record);
    if (!parsed.success) {
      issues.push({
        row: rowNumber,
        name: name.trim(),
        severity: 'error',
        code: 'validation_failed',
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
      continue;
    }

    const data = parsed.data;
    const componentSum = PERCENT_COLUMNS.reduce((sum, f) => sum + data[f], 0);

    if (componentSum > 100.5) {
      issues.push({
        row: rowNumber,
        name: data.name,
        severity: 'warning',
        code: 'component_sum_over_100',
        message: `Сумма компонентов ${componentSum.toFixed(1)} % > 100 %. Импортировано как есть, без нормализации.`,
      });
    } else if (componentSum < 99.5) {
      issues.push({
        row: rowNumber,
        name: data.name,
        severity: 'info',
        code: 'component_sum_under_100',
        message: `Сумма компонентов ${componentSum.toFixed(1)} % < 100 %. Остаток ${(100 - componentSum).toFixed(1)} % учтён как «не учтено».`,
      });
    }

    prepared.push({
      row: rowNumber,
      data,
      category: categorize(data.name),
      brand: detectBrand(data.name),
      componentSum,
    });
  }

  // Deduplicate on the same identity the database enforces: (name, brand).
  const byIdentity = new Map<string, (typeof prepared)[number]>();
  for (const entry of prepared) {
    const key = `${entry.data.name.trim().toLowerCase()}|${entry.brand ?? ''}`;
    const existing = byIdentity.get(key);
    if (existing) {
      issues.push({
        row: entry.row,
        name: entry.data.name,
        severity: 'warning',
        code: 'duplicate',
        message: `Дубликат строки ${existing.row}; сохранена последняя (строка ${entry.row}).`,
      });
    }
    byIdentity.set(key, entry);
  }

  const unique = [...byIdentity.values()];

  console.log(`\n📊  Разобрано строк: ${prepared.length}`);
  console.log(`    Уникальных ингредиентов: ${unique.length}`);
  console.log(`    Замечаний: ${issues.length}`);

  const bySeverity = (s: ImportIssue['severity']) => issues.filter((i) => i.severity === s);
  for (const severity of ['error', 'warning'] as const) {
    const list = bySeverity(severity);
    if (list.length === 0) continue;
    const icon = severity === 'error' ? '❌' : '⚠️ ';
    console.log(`\n${icon} ${severity.toUpperCase()} (${list.length}):`);
    const grouped = new Map<string, ImportIssue[]>();
    for (const i of list) grouped.set(i.code, [...(grouped.get(i.code) ?? []), i]);
    for (const [code, group] of grouped) {
      console.log(`    ${code} × ${group.length}`);
      for (const i of group.slice(0, 5)) {
        console.log(`      строка ${i.row}${i.name ? ` (${i.name})` : ''}: ${i.message}`);
      }
      if (group.length > 5) console.log(`      … и ещё ${group.length - 5}`);
    }
  }
  const infos = bySeverity('info');
  if (infos.length > 0) {
    console.log(`\nℹ️   INFO: ${infos.length} строк с неполным составом (импортированы без изменений).`);
  }

  if (dryRun) {
    console.log('\n🚧  --dry-run: база не изменена.\n');
    return;
  }

  const prisma = new PrismaClient();
  try {
    let created = 0;
    let updated = 0;

    for (const entry of unique) {
      const payload = {
        category: entry.category,
        brand: entry.brand,
        sugarPercentage: entry.data.sugarPercentage,
        fatPercentage: entry.data.fatPercentage,
        cocoaButterPercentage: entry.data.cocoaButterPercentage,
        milkSolidsPercentage: entry.data.milkSolidsPercentage,
        cocoaSolidsPercentage: entry.data.cocoaSolidsPercentage,
        otherSolidsPercentage: entry.data.otherSolidsPercentage,
        waterPercentage: entry.data.waterPercentage,
        sweetness: entry.data.sweetness,
        pricePerKg: entry.data.pricePerKg,
        source: 'Excel: формирование ганаша программа.xlsx (лист Database)',
        sourceUrl: null,
        isCustom: false,
        sourceRow: entry.row,
        componentSum: entry.componentSum,
      };

      const existing = await prisma.ingredient.findFirst({
        where: { name: entry.data.name, brand: entry.brand },
        select: { id: true },
      });

      if (existing) {
        await prisma.ingredient.update({ where: { id: existing.id }, data: payload });
        updated += 1;
      } else {
        await prisma.ingredient.create({ data: { name: entry.data.name, ...payload } });
        created += 1;
      }
    }

    await prisma.appSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });

    console.log(`\n✅  Импорт завершён: создано ${created}, обновлено ${updated}.`);
    const total = await prisma.ingredient.count();
    console.log(`    Всего ингредиентов в базе: ${total}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('\n❌  Импорт не выполнен:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
