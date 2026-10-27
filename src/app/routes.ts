import type { Route } from './state';

export function parseRoute(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '').trim().toLowerCase();
  if (clean.startsWith('missions')) return 'missions';
  if (clean.startsWith('teacher')) return 'teacher';
  return 'explore';
}

export function routeHash(route: Route): string {
  return `#/${route}`;
}

export const ROUTE_LABEL_KO: Record<Route, string> = {
  explore: '탐구',
  missions: '미션',
  teacher: '교사',
};
