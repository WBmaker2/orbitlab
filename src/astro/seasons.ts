import { SEASON_BOUNDARIES } from './constants';
import { daysToDate } from './time';

export type SeasonName = 'spring' | 'summer' | 'autumn' | 'winter';

export const SEASON_LABEL_KO: Record<SeasonName, string> = {
  spring: '봄',
  summer: '여름',
  autumn: '가을',
  winter: '겨울',
};

export const SEASON_SYMBOL: Record<SeasonName, string> = {
  spring: '새싹',
  summer: '햇살',
  autumn: '낙엽',
  winter: '눈송이',
};

const OPPOSITE: Record<SeasonName, SeasonName> = {
  spring: 'autumn',
  summer: 'winter',
  autumn: 'spring',
  winter: 'summer',
};

export function oppositeSeason(season: SeasonName): SeasonName {
  return OPPOSITE[season];
}

export function northernSeasonForDate(date: Date): SeasonName {
  const year = date.getUTCFullYear();
  const t = date.getTime();
  const b = SEASON_BOUNDARIES;
  const spring = Date.UTC(year, b.springMonth, b.springDay);
  const summer = Date.UTC(year, b.summerMonth, b.summerDay);
  const autumn = Date.UTC(year, b.autumnMonth, b.autumnDay);
  const winter = Date.UTC(year, b.winterMonth, b.winterDay);

  if (t >= spring && t < summer) return 'spring';
  if (t >= summer && t < autumn) return 'summer';
  if (t >= autumn && t < winter) return 'autumn';
  return 'winter';
}

export function northernSeasonForDays(days: number): SeasonName {
  return northernSeasonForDate(daysToDate(days));
}

export interface SeasonInfo {
  northern: SeasonName;
  southern: SeasonName;
  northernLabelKo: string;
  southernLabelKo: string;
  northernSymbol: string;
  southernSymbol: string;
}

export function seasonInfoForDays(days: number): SeasonInfo {
  const northern = northernSeasonForDays(days);
  const southern = oppositeSeason(northern);
  return {
    northern,
    southern,
    northernLabelKo: SEASON_LABEL_KO[northern],
    southernLabelKo: SEASON_LABEL_KO[southern],
    northernSymbol: SEASON_SYMBOL[northern],
    southernSymbol: SEASON_SYMBOL[southern],
  };
}

export function isSolsticeSeason(season: SeasonName): boolean {
  return season === 'summer' || season === 'winter';
}
