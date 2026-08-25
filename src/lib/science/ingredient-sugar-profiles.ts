/**
 * Assigning a sugar profile to an ingredient (spec §5, §11).
 *
 * The imported database has a single aggregate "сахара" column, so the species
 * breakdown has to come from knowledge about the ingredient itself. This module
 * resolves an ingredient to a SugarProfile through three ordered mechanisms:
 *
 *   1. An explicit per-ingredient override (highest confidence — set by the
 *      user or by a curated table).
 *   2. A name-pattern rule, for ingredients whose name states the sugar
 *      ("sugar inverted", "glucose 60DE", "sorbitol").
 *   3. The ingredient category (dairy → lactose, chocolate → sucrose, …).
 *
 * When nothing matches, the resolver returns `null` RATHER THAN a default.
 * Silently assuming sucrose would produce a confident-looking a_w built on an
 * invented composition, which is precisely what spec §48 forbids. An
 * unresolved ingredient degrades the result's confidence instead.
 */

import { SUGAR_PROFILES, type SugarProfile, type SugarProfileId } from './sugars';
import type { IngredientCategory } from '../calculator/types';

export type SugarProfileResolutionMethod =
  | 'explicit_override'
  | 'name_pattern'
  | 'category_default'
  | 'unresolved';

export interface ResolvedSugarProfile {
  profileId: SugarProfileId | null;
  profile: SugarProfile | null;
  method: SugarProfileResolutionMethod;
  /**
   * How much this particular assignment can be trusted, 0..1.
   *
   * Confidence belongs to the RULE, not to the method. "Chocolate's sugar is
   * sucrose" and "a fruit purée's sugars are 35/40/25 glucose/fructose/sucrose"
   * are both category defaults, but the first is near-certain (chocolate is
   * sweetened with sucrose by definition) while the second is a genuine
   * average over fruits that differ a lot. Grading them alike made every
   * ordinary ganache report low confidence, which drained the signal of
   * meaning.
   */
  confidence: number;
  /** Why this profile was chosen — shown in the traceability panel. */
  rationale: string;
}

/**
 * Name patterns, evaluated in order. First match wins, so more specific
 * patterns MUST come first (e.g. "glucose 60DE" before bare "glucose").
 */
interface NameRule {
  test: RegExp;
  profileId: SugarProfileId;
  /** 0..1 — see ResolvedSugarProfile.confidence. */
  confidence: number;
  rationale: string;
}

const NAME_RULES: readonly NameRule[] = [
  {
    test: /\b60\s*de\b/i,
    profileId: 'glucoseSyrup60DE',
    // The DE is stated in the name; only the Norrish K is an assumption.
    confidence: 0.95,
    rationale: 'Название содержит DE 60 — глюкозный сироп с указанным декстрозным эквивалентом.',
  },
  {
    test: /\b40\s*de\b/i,
    profileId: 'glucoseSyrup40DE',
    confidence: 0.95,
    rationale: 'Название содержит DE 40 — глюкозный сироп с указанным декстрозным эквивалентом.',
  },
  {
    test: /sorbitol|сорбит/i,
    profileId: 'pureSorbitol',
    confidence: 1,
    rationale: 'Название указывает на сорбит.',
  },
  {
    test: /invert|инверт/i,
    profileId: 'invertSugar',
    // Commercial invert syrup is rarely 100 % inverted; residual sucrose is
    // not modelled, which slightly overstates the a_w depression.
    confidence: 0.9,
    rationale: 'Название указывает на инвертный сахар: равные массовые доли глюкозы и фруктозы.',
  },
  {
    test: /dextrose|декстроз/i,
    profileId: 'pureDextrose',
    confidence: 1,
    rationale: 'Декстроза — чистая глюкоза.',
  },
  {
    test: /honey|мёд|мед\b/i,
    profileId: 'honey',
    confidence: 0.7,
    rationale: 'Мёд: инвертный по природе профиль с преобладанием фруктозы.',
  },
  {
    test: /glucose|глюкоз/i,
    profileId: 'glucoseSyrup40DE',
    // The DE is NOT stated — the single biggest unknown for a syrup.
    confidence: 0.5,
    rationale:
      'Название указывает на глюкозный сироп без DE. Принят DE 40 как более консервативный (меньшее понижение a_w). Уточните DE ингредиента для точного расчёта.',
  },
  {
    test: /fruit\s*pur[eé]e|пюре/i,
    profileId: 'fruitTypical',
    // The glucose/fructose/sucrose ratio varies strongly by fruit and ripeness.
    confidence: 0.5,
    rationale: 'Фруктовое пюре: усреднённый профиль глюкоза/фруктоза/сахароза.',
  },
  {
    test: /\bsugar\b|сахар/i,
    profileId: 'pureSucrose',
    confidence: 0.8,
    rationale: 'Название указывает на сахар без уточнения вида — принята сахароза.',
  },
];

const CATEGORY_RULES: Partial<
  Record<IngredientCategory, { profileId: SugarProfileId; confidence: number; rationale: string }>
> = {
  chocolate: {
    profileId: 'pureSucrose',
    // Near-certain: chocolate is sweetened with sucrose by definition, and the
    // standards of identity in every major jurisdiction assume it.
    confidence: 0.95,
    rationale:
      'Сахар шоколада вносится как сахароза. Молочный и белый шоколад дополнительно содержат лактозу молочных сухих веществ — она учитывается отдельно через колонку молочных сухих, а не через сахара.',
  },
  cocoa: {
    profileId: 'pureSucrose',
    // Unsweetened cocoa mass has no sugar at all, so this only bites for
    // sweetened cocoa products; when it does, the sugar is sucrose.
    confidence: 0.85,
    rationale: 'Подслащённые какао-продукты содержат добавленную сахарозу.',
  },
  dairy: {
    profileId: 'dairyLactose',
    // Definitional: the sugar of milk IS lactose.
    confidence: 0.95,
    rationale: 'Сахар молочных продуктов — лактоза.',
  },
  fruit: {
    profileId: 'fruitTypical',
    // A genuine average over fruits that differ substantially.
    confidence: 0.5,
    rationale: 'Фруктовые ингредиенты: усреднённый профиль глюкоза/фруктоза/сахароза.',
  },
  sugar: {
    profileId: 'pureSucrose',
    // The category says "sugar" but not which one.
    confidence: 0.6,
    rationale: 'Категория «сахар» без более точного признака — принята сахароза.',
  },
};

export interface SugarProfileOverride {
  ingredientId: string;
  profileId: SugarProfileId;
  rationale?: string;
}

export function resolveSugarProfile(
  ingredient: { id: string; name: string; category: IngredientCategory },
  overrides: readonly SugarProfileOverride[] = [],
): ResolvedSugarProfile {
  const override = overrides.find((o) => o.ingredientId === ingredient.id);
  if (override) {
    return {
      profileId: override.profileId,
      profile: SUGAR_PROFILES[override.profileId],
      method: 'explicit_override',
      confidence: 1,
      rationale: override.rationale ?? 'Профиль сахаров задан пользователем для этого ингредиента.',
    };
  }

  for (const rule of NAME_RULES) {
    if (rule.test.test(ingredient.name)) {
      return {
        profileId: rule.profileId,
        profile: SUGAR_PROFILES[rule.profileId],
        method: 'name_pattern',
        confidence: rule.confidence,
        rationale: rule.rationale,
      };
    }
  }

  const categoryRule = CATEGORY_RULES[ingredient.category];
  if (categoryRule) {
    return {
      profileId: categoryRule.profileId,
      profile: SUGAR_PROFILES[categoryRule.profileId],
      method: 'category_default',
      confidence: categoryRule.confidence,
      rationale: categoryRule.rationale,
    };
  }

  return {
    profileId: null,
    profile: null,
    method: 'unresolved',
    confidence: 0,
    rationale:
      'Вид сахаров этого ингредиента определить не удалось. Сахара учтены в массовом балансе, но исключены из расчёта a_w, а уверенность результата понижена.',
  };
}

/**
 * Fallback weight per method, used only when a caller has no per-rule
 * confidence to hand. Prefer `ResolvedSugarProfile.confidence`, which grades
 * the specific rule rather than the mechanism.
 */
export const RESOLUTION_CONFIDENCE: Record<SugarProfileResolutionMethod, number> = {
  explicit_override: 1,
  name_pattern: 0.9,
  category_default: 0.6,
  unresolved: 0,
};
