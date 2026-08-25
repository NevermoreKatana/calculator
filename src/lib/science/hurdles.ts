/**
 * Hurdle analysis (spec §17).
 *
 * ── What this module does and does not do ─────────────────────────────────
 * Hurdle technology (Leistner) says that several sub-lethal barriers combine to
 * give stability that no single barrier provides. Its quantitative form is the
 * gamma concept (Zwietering): μ = μ_opt · γ(T) · γ(pH) · γ(a_w) · …
 *
 * The gamma model is NOT instantiated numerically here, and the reason is
 * specific rather than cautious: it needs cardinal parameters (a_w,min, pH_min,
 * T_min, μ_opt) for the organisms of concern IN THIS MATRIX. Those exist for
 * model broths and for a few well-studied foods; they do not exist for
 * Zygosaccharomyces rouxii in a fat-continuous chocolate emulsion. Substituting
 * broth parameters would produce a growth rate in units of 1/h that looks
 * authoritative and means nothing.
 *
 * What the module does instead is enumerate the barriers, state which are
 * PRESENT, ABSENT or UNKNOWN, and explain each one's actual contribution. That
 * is genuinely useful — it tells a formulator which lever is missing — without
 * fabricating a number.
 */

import { FDA_SAFETY_AW_THRESHOLD, SORBIC_ACID_PKA, BRIX_INHIBITION_THRESHOLD } from './constants';
import { undissociatedFraction } from './water-activity/equations';
import { lowestRelevantGrowthAw } from './microbiology';

export type HurdleId =
  | 'water_activity'
  | 'ph'
  | 'temperature'
  | 'preservative'
  | 'ethanol'
  | 'packaging'
  | 'thermal_treatment'
  | 'sugar_concentration'
  | 'fat_barrier'
  | 'hygiene';

export type HurdleState = 'effective' | 'partial' | 'absent' | 'unknown';

export const HURDLE_STATE_LABELS: Record<HurdleState, string> = {
  effective: 'Барьер работает',
  partial: 'Барьер частичный',
  absent: 'Барьер отсутствует',
  unknown: 'Нет данных',
};

export interface Hurdle {
  id: HurdleId;
  label: string;
  state: HurdleState;
  /** What the value is, when there is one. */
  valueLabel: string | null;
  /** Concrete explanation of this barrier's contribution to THIS recipe. */
  explanation: string;
  sourceIds: string[];
  /** Actionable suggestion when the barrier is absent or partial. */
  recommendation?: string;
}

export interface HurdleAnalysisInput {
  waterActivity: number | null;
  /** True when a_w came from an instrument rather than the model. */
  waterActivityMeasured: boolean;
  measuredPH?: number | null;
  storageTemperatureC?: number | null;
  /** Dissolved solids in the water phase, %. */
  dissolvedSolidsPercent?: number | null;
  /** Ethanol as % of the water phase mass. */
  ethanolPercentOfWaterPhase?: number | null;
  hasPreservative?: boolean;
  preservativeName?: string | null;
  packagingSealed?: boolean | null;
  chocolateShell?: boolean | null;
  thermalTreatment?: boolean | null;
  /** Total fat as % of the product. */
  fatPercentage?: number | null;
}

export interface HurdleAnalysis {
  hurdles: Hurdle[];
  effectiveCount: number;
  partialCount: number;
  absentCount: number;
  unknownCount: number;
  /** Plain-language summary; never a number of days. */
  summary: string;
  /** Barriers whose absence most limits this formulation. */
  criticalGaps: string[];
}

export function analyseHurdles(input: HurdleAnalysisInput): HurdleAnalysis {
  const hurdles: Hurdle[] = [];
  const lowestGrowthAw = lowestRelevantGrowthAw(true);

  // ── 1. Water activity ──────────────────────────────────────────────────
  {
    const aw = input.waterActivity;
    let state: HurdleState = 'unknown';
    let explanation =
      'Активность воды не определена. Это главный барьер кондитерских изделий, и без него оценка стабильности невозможна.';
    let recommendation: string | undefined =
      'Измерьте a_w прибором либо укажите состав так, чтобы модель могла её рассчитать.';

    if (typeof aw === 'number' && Number.isFinite(aw)) {
      if (aw < lowestGrowthAw) {
        state = 'effective';
        explanation = `a_w = ${aw.toFixed(3)} ниже ${lowestGrowthAw} — предела роста самых устойчивых организмов (осмофильные дрожжи, ксерофильные плесени). Микробиологический рост не ожидается.`;
        recommendation = undefined;
      } else if (aw <= FDA_SAFETY_AW_THRESHOLD.value) {
        state = 'effective';
        explanation = `a_w = ${aw.toFixed(3)} не превышает регуляторный порог FDA ${FDA_SAFETY_AW_THRESHOLD.value}: рост патогенных бактерий не ожидается. Осмофильные дрожжи и ксерофильные плесени при этом значении расти МОГУТ — это барьер безопасности, а не барьер порчи.`;
        recommendation =
          'Для подавления порчи, а не только патогенов, целевой диапазон отраслевой литературы — a_w 0.70–0.78.';
      } else if (aw <= 0.9) {
        state = 'partial';
        explanation = `a_w = ${aw.toFixed(3)} выше порога FDA ${FDA_SAFETY_AW_THRESHOLD.value}. В этой зоне возможен рост Staphylococcus aureus, дрожжей и плесеней. Обзор по ганашу связывает a_w выше 0.85 со сроком годности менее двух недель.`;
        recommendation =
          'Понизьте a_w: замените часть сахарозы инвертным сахаром или сиропом с высоким DE, либо снизьте долю воды.';
      } else {
        state = 'absent';
        explanation = `a_w = ${aw.toFixed(3)} — барьер по активности воды отсутствует. Возможен рост большинства бактерий, включая патогенные.`;
        recommendation = 'Продукт требует холодильного хранения и короткого срока, либо изменения рецептуры.';
      }
    }

    hurdles.push({
      id: 'water_activity',
      label: 'Активность воды (a_w)',
      state,
      valueLabel:
        typeof aw === 'number' && Number.isFinite(aw)
          ? `${aw.toFixed(3)}${input.waterActivityMeasured ? ' (измерено)' : ' (расчёт)'}`
          : null,
      explanation,
      sourceIds: ['fda-food-code-ch3', 'pitt-hocking-fungi', 'lapcikova-2024-ganache'],
      recommendation,
    });
  }

  // ── 2. pH ──────────────────────────────────────────────────────────────
  {
    const pH = input.measuredPH;
    let state: HurdleState = 'unknown';
    let explanation =
      'pH не измерен. Рассчитать pH из рецептуры в общем случае нельзя: он зависит от буферной ёмкости белков молока, органических кислот фруктов и щелочности алкализованного какао.';
    let recommendation: string | undefined = 'Измерьте pH pH-метром в водной фазе продукта.';

    if (typeof pH === 'number' && Number.isFinite(pH)) {
      if (pH < 4.6) {
        state = 'effective';
        explanation = `pH = ${pH.toFixed(2)} ниже 4.6 — порога, ниже которого не растёт Clostridium botulinum. Кислая среда подавляет большинство бактерий. ВАЖНО: на Zygosaccharomyces rouxii, главный организм порчи сладких начинок, pH в диапазоне 2.5–4.0 практически не действует (Vermeulen et al.).`;
        recommendation = undefined;
      } else if (pH < 5.2) {
        state = 'partial';
        explanation = `pH = ${pH.toFixed(2)} умеренно кислый: часть бактерий подавлена, но не дрожжи и плесени.`;
        recommendation = undefined;
      } else {
        state = 'absent';
        explanation = `pH = ${pH.toFixed(2)} близок к нейтральному — типично для молочно-шоколадного ганаша. Барьер по кислотности отсутствует, и слабокислотные консерванты при таком pH почти неактивны.`;
        recommendation =
          'Барьер по pH недостижим без изменения органолептики. Опирайтесь на a_w, температуру и упаковку.';
      }
    }

    hurdles.push({
      id: 'ph',
      label: 'Кислотность (pH)',
      state,
      valueLabel: typeof pH === 'number' && Number.isFinite(pH) ? pH.toFixed(2) : null,
      explanation,
      sourceIds: ['fda-food-code-ch3', 'vanderveken-2014-zrouxii-imf'],
      recommendation,
    });
  }

  // ── 3. Temperature ─────────────────────────────────────────────────────
  {
    const t = input.storageTemperatureC;
    let state: HurdleState = 'unknown';
    let explanation = 'Температура хранения не задана.';
    let recommendation: string | undefined = 'Укажите температуру хранения.';

    if (typeof t === 'number' && Number.isFinite(t)) {
      if (t <= 6) {
        state = 'effective';
        explanation = `Хранение при ${t} °C существенно замедляет рост. ОГОВОРКА: Listeria monocytogenes растёт от −0.4 °C, поэтому холод сам по себе не является барьером против неё.`;
        recommendation = undefined;
      } else if (t <= 18) {
        state = 'partial';
        explanation = `${t} °C — прохладное хранение: рост замедлен, но не остановлен.`;
        recommendation = undefined;
      } else {
        state = 'absent';
        explanation = `${t} °C — комнатное хранение. Температурный барьер отсутствует, вся нагрузка ложится на a_w и упаковку.`;
        recommendation = 'Либо снизьте a_w до 0.70–0.78, либо перейдите на холодильное хранение.';
      }
    }

    hurdles.push({
      id: 'temperature',
      label: 'Температура хранения',
      state,
      valueLabel: typeof t === 'number' && Number.isFinite(t) ? `${t} °C` : null,
      explanation,
      sourceIds: ['fda-food-code-ch3', 'vniiz-aw-fillings'],
      recommendation,
    });
  }

  // ── 4. Preservative ────────────────────────────────────────────────────
  {
    const has = input.hasPreservative === true;
    const pH = input.measuredPH;
    let state: HurdleState = has ? 'unknown' : 'absent';
    let explanation = has
      ? 'Консервант заявлен, но без измеренного pH его активная доля неизвестна.'
      : 'Консерванты не используются.';
    let valueLabel: string | null = null;
    let recommendation: string | undefined;

    if (has && typeof pH === 'number' && Number.isFinite(pH)) {
      const f = undissociatedFraction(pH, SORBIC_ACID_PKA.value);
      valueLabel = `${(f * 100).toFixed(1)} % в активной форме`;
      if (f >= 0.5) {
        state = 'effective';
        explanation = `При pH ${pH.toFixed(2)} сорбиновая кислота недиссоциирована на ${(f * 100).toFixed(1)} %. Противомикробное действие оказывает именно недиссоциированная форма, поэтому консервант работает.`;
      } else if (f >= 0.1) {
        state = 'partial';
        explanation = `При pH ${pH.toFixed(2)} активна лишь ${(f * 100).toFixed(1)} % кислоты. Эффективность заметно снижена.`;
      } else {
        state = 'absent';
        explanation = `При pH ${pH.toFixed(2)} активна лишь ${(f * 100).toFixed(1)} % кислоты — консервант практически не работает. Это типичная ситуация для ганаша, чей pH близок к нейтральному.`;
        recommendation =
          'Сорбат эффективен во фруктовых начинках (pH 3–4), а не в молочно-шоколадном ганаше. Рассчитывать на него здесь нельзя.';
      }
    } else if (!has) {
      recommendation =
        'Дозировки консервантов регулируются законодательством конкретной страны и в приложении не приводятся.';
    }

    hurdles.push({
      id: 'preservative',
      label: 'Консерванты',
      state,
      valueLabel,
      explanation,
      sourceIds: ['sorbic-acid-pka'],
      recommendation,
    });
  }

  // ── 5. Ethanol ─────────────────────────────────────────────────────────
  {
    const e = input.ethanolPercentOfWaterPhase;
    let state: HurdleState = 'unknown';
    let explanation = 'Содержание спирта в водной фазе не определено.';

    if (typeof e === 'number' && Number.isFinite(e)) {
      if (e <= 0) {
        state = 'absent';
        explanation = 'Спирт не используется.';
      } else if (e >= 5) {
        state = 'effective';
        explanation = `Спирт составляет ${e.toFixed(1)} % водной фазы. Этанол — один из немногих барьеров, действующих на Zygosaccharomyces rouxii, и в моделях роста/отсутствия роста он оказывал наиболее выраженное влияние в первые 30 суток.`;
      } else {
        state = 'partial';
        explanation = `Спирт составляет ${e.toFixed(1)} % водной фазы — вклад есть, но как самостоятельный барьер этого мало.`;
      }
    }

    hurdles.push({
      id: 'ethanol',
      label: 'Спирт',
      state,
      valueLabel: typeof e === 'number' && Number.isFinite(e) ? `${e.toFixed(1)} % водной фазы` : null,
      explanation,
      sourceIds: ['vanderveken-2014-zrouxii-imf'],
    });
  }

  // ── 6. Sugar concentration of the water phase ──────────────────────────
  {
    const brix = input.dissolvedSolidsPercent;
    let state: HurdleState = 'unknown';
    let explanation = 'Концентрация растворённых сухих веществ водной фазы не определена.';

    if (typeof brix === 'number' && Number.isFinite(brix)) {
      if (brix >= BRIX_INHIBITION_THRESHOLD.value) {
        state = 'effective';
        explanation = `Водная фаза содержит ${brix.toFixed(1)} % растворённых сухих веществ — выше ${BRIX_INHIBITION_THRESHOLD.value} °Brix, при которых обзор по ганашу описывает подавление роста микроорганизмов при комнатном хранении. Это тот же осмотический эффект, что и низкая a_w, выраженный иначе.`;
      } else if (brix >= 60) {
        state = 'partial';
        explanation = `Водная фаза содержит ${brix.toFixed(1)} % растворённых сухих веществ — ниже ориентира ${BRIX_INHIBITION_THRESHOLD.value} °Brix.`;
      } else {
        state = 'absent';
        explanation = `Водная фаза разбавлена: ${brix.toFixed(1)} % растворённых сухих веществ. Осмотический барьер отсутствует.`;
      }
    }

    hurdles.push({
      id: 'sugar_concentration',
      label: 'Концентрация водной фазы',
      state,
      valueLabel:
        typeof brix === 'number' && Number.isFinite(brix) ? `${brix.toFixed(1)} % раств. сухих веществ` : null,
      explanation,
      sourceIds: ['lapcikova-2024-ganache'],
    });
  }

  // ── 7. Packaging ───────────────────────────────────────────────────────
  {
    const sealed = input.packagingSealed;
    hurdles.push({
      id: 'packaging',
      label: 'Упаковка',
      state: sealed === true ? 'effective' : sealed === false ? 'absent' : 'unknown',
      valueLabel: sealed === true ? 'герметичная' : sealed === false ? 'негерметичная' : null,
      explanation:
        sealed === true
          ? 'Герметичная упаковка ограничивает обмен влагой с окружающим воздухом и повторное обсеменение. Это единственное, что удерживает рассчитанную a_w постоянной во времени.'
          : sealed === false
            ? 'Без герметичной упаковки продукт стремится к равновесию с влажностью помещения: a_w меняется, и расчёт для момента изготовления перестаёт описывать продукт.'
            : 'Тип упаковки не указан.',
      sourceIds: ['lapcikova-2024-ganache', 'vniiz-aw-fillings'],
      recommendation:
        sealed === false
          ? 'Герметичная тара (например, полипропиленовый контейнер с плёнкой) снижает и окисление, и миграцию влаги.'
          : undefined,
    });
  }

  // ── 8. Chocolate shell / fat barrier ───────────────────────────────────
  {
    const shell = input.chocolateShell;
    const fat = input.fatPercentage;
    hurdles.push({
      id: 'fat_barrier',
      label: 'Шоколадная оболочка и жировая фаза',
      state: shell === true ? 'partial' : shell === false ? 'absent' : 'unknown',
      valueLabel: typeof fat === 'number' && Number.isFinite(fat) ? `жир ${fat.toFixed(1)} %` : null,
      explanation:
        shell === true
          ? 'Шоколадная оболочка замедляет обмен влагой, но НЕ является герметичным барьером: вода и этанол мигрируют сквозь неё. Именно эта миграция вызывает растрескивание оболочки — дефект тем вероятнее, чем выше a_w начинки.'
          : shell === false
            ? 'Оболочки нет: начинка контактирует с воздухом напрямую, и поверхность подсыхает или увлажняется.'
            : 'Наличие шоколадной оболочки не указано.',
      sourceIds: ['lapcikova-2024-ganache'],
      recommendation:
        shell === true
          ? 'Оболочка не заменяет барьер по a_w. Обзор по ганашу сообщает, что пралине с a_w 0.99 трескались первыми и чаще, чем с a_w 0.86 и 0.78.'
          : undefined,
    });
  }

  // ── 9. Thermal treatment ───────────────────────────────────────────────
  {
    const t = input.thermalTreatment;
    hurdles.push({
      id: 'thermal_treatment',
      label: 'Тепловая обработка',
      state: t === true ? 'partial' : t === false ? 'absent' : 'unknown',
      valueLabel: null,
      explanation:
        t === true
          ? 'Прогрев сливок снижает исходное микробное обсеменение. Барьер частичный: споровые формы (Bacillus cereus) переживают обычный прогрев, а повторное обсеменение возможно на этапах после нагрева.'
          : t === false
            ? 'Тепловой обработки нет: исходная микрофлора сырья попадает в продукт целиком.'
            : 'Данных о тепловой обработке нет.',
      sourceIds: ['lapcikova-2024-ganache', 'icmsf-1996-microbial-ecology'],
    });
  }

  // ── 10. Hygiene ────────────────────────────────────────────────────────
  {
    hurdles.push({
      id: 'hygiene',
      label: 'Производственная гигиена',
      state: 'unknown',
      valueLabel: null,
      explanation:
        'Гигиена не может быть рассчитана из рецептуры, и её роль трудно переоценить: исходное обсеменение определяет, сколько времени нужно микроорганизмам, чтобы достичь заметного уровня, при одинаковой a_w. Два одинаковых по составу ганаша с разной гигиеной производства дадут разный фактический срок.',
      sourceIds: ['leistner-hurdle'],
      recommendation: 'Подтверждается микробиологическим контролем продукции, а не расчётом.',
    });
  }

  const effectiveCount = hurdles.filter((h) => h.state === 'effective').length;
  const partialCount = hurdles.filter((h) => h.state === 'partial').length;
  const absentCount = hurdles.filter((h) => h.state === 'absent').length;
  const unknownCount = hurdles.filter((h) => h.state === 'unknown').length;

  const criticalGaps = hurdles
    .filter((h) => (h.state === 'absent' || h.state === 'unknown') && h.recommendation)
    .map((h) => `${h.label}: ${h.recommendation}`);

  const summary =
    unknownCount > hurdles.length / 2
      ? `Определено слишком мало барьеров (${unknownCount} из ${hurdles.length} неизвестны), чтобы говорить о стабильности продукта.`
      : `Из ${hurdles.length} барьеров работают ${effectiveCount}, частичны ${partialCount}, отсутствуют ${absentCount}, не определены ${unknownCount}. По концепции барьеров устойчивость обеспечивается их совокупностью, а не одним фактором, поэтому число работающих барьеров важнее величины любого из них по отдельности.`;

  return { hurdles, effectiveCount, partialCount, absentCount, unknownCount, summary, criticalGaps };
}
