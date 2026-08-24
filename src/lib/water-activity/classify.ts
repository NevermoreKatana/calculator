import {
  WATER_ACTIVITY_ZONES,
  zoneContains,
  type MicrobialRiskLevel,
  type WaterActivityZone,
} from './zones';

export interface WaterActivityClassification {
  waterActivity: number;
  /**
   * Every zone whose range contains the value. More than one is normal and
   * expected — the source chart's bands overlap by design (spec §20).
   */
  zones: WaterActivityZone[];
  /** Stable ids, suitable for storing as biological risk flags. */
  risks: string[];
  /**
   * The zone shown as "текущая зона" in the UI: the matching zone with the
   * highest lower bound, i.e. the most severe threshold the value has crossed.
   * At a_w = 0.86 this resolves to the Staphylococcus aureus band rather than
   * "большинство плесеней", matching the worked example in spec §21.
   */
  primaryZone: WaterActivityZone | null;
  highestRiskLevel: MicrobialRiskLevel;
}

const RISK_ORDER: Record<MicrobialRiskLevel, number> = {
  none: 0,
  low: 1,
  moderate: 2,
  high: 3,
  severe: 4,
};

/**
 * Maps a measured or supplied a_w onto the microbiological zones.
 *
 * This is a lookup against transcribed chart data — it is NOT a prediction of
 * shelf life. a_w says which organisms could grow, not for how many days the
 * product keeps (spec §22).
 */
export function classifyWaterActivity(aw: number): WaterActivityClassification | null {
  if (!Number.isFinite(aw)) return null;

  const zones = WATER_ACTIVITY_ZONES.filter((zone) => zoneContains(zone, aw));

  const primaryZone =
    zones.length === 0
      ? null
      : zones.reduce((best, zone) =>
          (zone.min ?? Number.NEGATIVE_INFINITY) > (best.min ?? Number.NEGATIVE_INFINITY)
            ? zone
            : best,
        );

  const highestRiskLevel = zones.reduce<MicrobialRiskLevel>(
    (worst, zone) => (RISK_ORDER[zone.riskLevel] > RISK_ORDER[worst] ? zone.riskLevel : worst),
    'none',
  );

  return {
    waterActivity: aw,
    zones: [...zones],
    risks: zones.map((zone) => zone.id),
    primaryZone,
    highestRiskLevel,
  };
}
