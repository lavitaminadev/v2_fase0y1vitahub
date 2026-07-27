export enum XpTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
  DIAMOND = 'diamond',
}

export const XP_TIER_THRESHOLDS: Record<XpTier, number> = {
  [XpTier.BRONZE]: 30,
  [XpTier.SILVER]: 60,
  [XpTier.GOLD]: 100,
  [XpTier.PLATINUM]: 150,
  [XpTier.DIAMOND]: 200,
};
