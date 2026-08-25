/**
 * Scientific calculation engine (spec §31, §55, §56).
 *
 * Layering, strictly one-directional:
 *
 *   Ingredient Database
 *        ↓
 *   Recipe Mass Balance      src/lib/calculator
 *        ↓
 *   Composition Analysis     src/lib/calculator
 *        ↓
 *   Water / Solute Model     science/aqueous-phase.ts
 *        ↓
 *   Water Activity Model     science/water-activity/
 *        ↓
 *   Microbiological Model    science/microbiology.ts
 *        ↓
 *   Hurdle / Stability Model science/hurdles.ts
 *        ↓
 *   Shelf Life Model         src/lib/shelf-life
 *
 * No React component imports anything below "Composition Analysis" directly;
 * the UI receives finished results with provenance attached (spec §55).
 */

export * from './confidence';
export * from './sources';
export * from './formulas';
export * from './constants';
export * from './sugars';
export * from './ingredient-sugar-profiles';
export * from './aqueous-phase';
export * from './microbiology';
export * from './hurdles';
export * from './parameter-capabilities';
export * from './recipe-adapter';
export * from './reference-point-analysis';
export * from './water-activity/equations';
export * from './water-activity/composition-model';
