import { PieceType } from '../production/piece-type.enum';

export const UD_MATRIX: Record<string, number> = {
  [PieceType.POST_SIMPLE]: 1.0,
  [PieceType.POST_AUTHOR]: 1.5,
  [PieceType.STORY_ORIGINAL]: 0.4,
  [PieceType.STORY_ADAPTED]: 0.1,
  [PieceType.STORY_TEMPLATE]: 0.2,
  [PieceType.REEL_COVER]: 0.3,
  [PieceType.FLYER_DIGITAL]: 1.5,
  [PieceType.FLYER_PRINT]: 2.0,
};

export const CAROUSEL_BASE_UD = 1.0;
export const CAROUSEL_EXTRA_PER_SLIDE = 0.4;

export function calculatePieceUd(pieceType: string, carouselSlides = 0): number {
  if (pieceType === PieceType.CAROUSEL) {
    return CAROUSEL_BASE_UD + Math.max(0, carouselSlides - 1) * CAROUSEL_EXTRA_PER_SLIDE;
  }
  return UD_MATRIX[pieceType] ?? 1.0;
}
