/**
 * Generates docs/scientific-research/FORMULA-INVENTORY.md and the parameter
 * capability table from the code registries (spec §34, §35, §47).
 *
 * The document is GENERATED rather than hand-written so it cannot drift away
 * from what the engine actually does. Run `npm run docs:formulas` after
 * changing any registry.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SCIENTIFIC_FORMULAS,
  IMPLEMENTATION_STATUS_LABELS,
} from '../src/lib/science/formulas';
import { SCIENTIFIC_SOURCES, getSource } from '../src/lib/science/sources';
import { PARAMETER_CAPABILITIES } from '../src/lib/science/parameter-capabilities';
import { NORRISH_CONSTANTS } from '../src/lib/science/constants';
import { EVIDENCE_STATUS_LABELS, CONFIDENCE_LABELS, PARAMETER_KIND_LABELS } from '../src/lib/science/confidence';

const yn = (b: boolean) => (b ? 'да' : 'нет');
const sourceLabel = (id: string) => {
  const s = getSource(id);
  if (!s) return `**НЕИЗВЕСТНЫЙ ИСТОЧНИК: ${id}**`;
  const who = s.authors[0] ?? s.publication;
  return `${who}${s.year ? ` (${s.year})` : ''}`;
};

const lines: string[] = [];

lines.push('# FORMULA-INVENTORY');
lines.push('');
lines.push('> **Файл сгенерирован автоматически** из `src/lib/science/`.');
lines.push('> Не редактируйте вручную — запустите `npm run docs:formulas`.');
lines.push('');
lines.push(`Формул в реестре: **${SCIENTIFIC_FORMULAS.length}**. Источников: **${SCIENTIFIC_SOURCES.length}**.`);
lines.push('');

// ── Summary table ────────────────────────────────────────────────────────
lines.push('## 1. Сводка');
lines.push('');
lines.push('| Формула | Статус реализации | Достоверность | Применимость к ганашу |');
lines.push('|---|---|---|---|');
for (const f of SCIENTIFIC_FORMULAS) {
  const short = f.ganacheApplicability.split('.')[0].slice(0, 110);
  lines.push(
    `| **${f.nameRu}** | ${IMPLEMENTATION_STATUS_LABELS[f.implementationStatus]} | ${EVIDENCE_STATUS_LABELS[f.status]} | ${short}… |`,
  );
}
lines.push('');

// ── Full detail ──────────────────────────────────────────────────────────
lines.push('## 2. Полное описание');
lines.push('');
for (const f of SCIENTIFIC_FORMULAS) {
  lines.push(`### ${f.nameRu}`);
  lines.push('');
  lines.push(`\`id: ${f.id}\``);
  lines.push('');
  lines.push('```');
  lines.push(f.equation);
  lines.push('```');
  lines.push('');
  if (f.variables.length > 0) {
    lines.push('| Символ | Значение | Единицы |');
    lines.push('|---|---|---|');
    for (const v of f.variables) lines.push(`| \`${v.symbol}\` | ${v.meaning} | ${v.unit} |`);
    lines.push('');
  }
  lines.push(`**Область создания:** ${f.domain}`);
  lines.push('');
  lines.push(`**Применимость:** ${f.applicability}`);
  lines.push('');
  lines.push(`**Применимость к ганашу:** ${f.ganacheApplicability}`);
  lines.push('');
  lines.push(`**Диапазон действия:** ${f.validityRange}`);
  lines.push('');
  lines.push(`**Точность:** ${f.accuracy}`);
  lines.push('');
  if (f.assumptions.length > 0) {
    lines.push('**Допущения:**');
    lines.push('');
    for (const a of f.assumptions) lines.push(`- ${a}`);
    lines.push('');
  }
  if (f.limitations.length > 0) {
    lines.push('**Ограничения:**');
    lines.push('');
    for (const l of f.limitations) lines.push(`- ${l}`);
    lines.push('');
  }
  lines.push(`**Достоверность:** ${EVIDENCE_STATUS_LABELS[f.status]}`);
  lines.push('');
  lines.push(`**Статус реализации:** ${IMPLEMENTATION_STATUS_LABELS[f.implementationStatus]}`);
  if (f.implementationPath) lines.push(`  \n**Код:** \`${f.implementationPath}\``);
  lines.push('');
  lines.push('**Источники:**');
  lines.push('');
  for (const id of f.sourceIds) {
    const s = getSource(id);
    lines.push(`- ${sourceLabel(id)} — ${s?.title ?? ''}${s?.url ? ` — ${s.url}` : ''}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
}

// ── Constants ────────────────────────────────────────────────────────────
lines.push('## 3. Константы Норриша');
lines.push('');
lines.push('Соглашение: `a_w = X_w · exp(−K · X_s²)`, K положительна.');
lines.push('');
lines.push('| Вещество | K | ± | Достоверность | Проверенный диапазон | Источники |');
lines.push('|---|---|---|---|---|---|');
for (const [name, c] of Object.entries(NORRISH_CONSTANTS)) {
  lines.push(
    `| ${name} | ${c.k} | ${c.uncertainty ?? '—'} | ${EVIDENCE_STATUS_LABELS[c.status]} | ${c.validatedRange} | ${c.sourceIds.map(sourceLabel).join('; ')} |`,
  );
}
lines.push('');

// ── Capability table §47 ─────────────────────────────────────────────────
lines.push('## 4. Что можно рассчитать (ТЗ §47)');
lines.push('');
lines.push('| Параметр | Из рецепта? | Нужно измерение? | Нужна калибровка? | Категория | Уверенность | Рекомендуемый метод |');
lines.push('|---|---|---|---|---|---|---|');
for (const c of PARAMETER_CAPABILITIES) {
  lines.push(
    `| **${c.parameter}** | ${yn(c.fromRecipe)} | ${yn(c.requiresMeasurement)} | ${yn(c.requiresCalibration)} | ${PARAMETER_KIND_LABELS[c.kind]} | ${CONFIDENCE_LABELS[c.confidence]} | ${c.recommendedMethod} |`,
  );
}
lines.push('');

// ── Sources ──────────────────────────────────────────────────────────────
lines.push('## 5. Реестр источников');
lines.push('');
for (const tier of ['S', 'A', 'B', 'C'] as const) {
  const inTier = SCIENTIFIC_SOURCES.filter((s) => s.tier === tier);
  if (inTier.length === 0) continue;
  lines.push(`### Уровень ${tier} (${inTier.length})`);
  lines.push('');
  for (const s of inTier) {
    lines.push(
      `- **${s.title}** — ${s.authors.join(', ')}${s.year ? `, ${s.year}` : ''}. *${s.publication}*. Язык: ${s.language}.${s.doi ? ` DOI: ${s.doi}.` : ''}${s.url ? ` ${s.url}` : ''}`,
    );
    lines.push(`  - **Используется для:** ${s.usedFor}`);
    if (s.caveats) lines.push(`  - **Оговорки:** ${s.caveats}`);
  }
  lines.push('');
}

const out = join(process.cwd(), 'docs', 'scientific-research', 'FORMULA-INVENTORY.md');
writeFileSync(out, lines.join('\n'), 'utf8');
console.log(`Wrote ${out} (${lines.length} lines)`);
