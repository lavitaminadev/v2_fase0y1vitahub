import { XpTier, XP_TIER_THRESHOLDS } from './xp-tier.enum';

export const BASE_XP: Record<number, number> = {
  1: 5, 2: 10, 3: 20, 4: 40, 5: 80,
};

export const EXPECTED_HOURS: Record<number, number> = {
  1: 0.75, 2: 1.5, 3: 3, 4: 5, 5: 8,
};

export interface DeliveryXpParams {
  difficultyLevel: number;
  actualHours: number;
  expectedHours?: number;
  perfectNaming: boolean;
  hadDesignerErrorCorrection: boolean;
  delayJustification?: string | null;
}

export function calculateBase(level: number): number {
  return BASE_XP[level] ?? 0;
}

export function calculateDeliveryXp(params: DeliveryXpParams): number {
  const base = calculateBase(params.difficultyLevel);
  let xp = base;
  const expected = params.expectedHours ?? EXPECTED_HOURS[params.difficultyLevel] ?? 3;

  if (expected > 0) {
    const ratio = params.actualHours / expected;
    if (ratio <= 0.5) xp += Math.round(base * 0.5);
    else if (ratio <= 0.75) xp += Math.round(base * 0.25);
  }

  if (params.perfectNaming) xp += 2;

  if (params.actualHours > expected) {
    const overdue = params.actualHours - expected;
    if (overdue <= 2) xp = Math.round(xp * 0.8);
    else if (params.delayJustification) xp = Math.round(xp * 0.5);
    else xp = Math.round(xp * 0.25);
  }

  if (params.hadDesignerErrorCorrection) xp -= 5;

  return Math.max(0, xp);
}

export function calculateWeeklyTier(totalXp: number): XpTier | null {
  if (totalXp >= XP_TIER_THRESHOLDS[XpTier.DIAMOND]) return XpTier.DIAMOND;
  if (totalXp >= XP_TIER_THRESHOLDS[XpTier.PLATINUM]) return XpTier.PLATINUM;
  if (totalXp >= XP_TIER_THRESHOLDS[XpTier.GOLD]) return XpTier.GOLD;
  if (totalXp >= XP_TIER_THRESHOLDS[XpTier.SILVER]) return XpTier.SILVER;
  if (totalXp >= XP_TIER_THRESHOLDS[XpTier.BRONZE]) return XpTier.BRONZE;
  return null;
}
