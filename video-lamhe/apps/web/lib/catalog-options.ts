import {
  DRONE_SORTS,
  EVENT_TYPES,
  OPERATOR_SORTS,
  type DroneSort,
  type OperatorSort,
} from '@video-lamhe/shared';
import { eventShort } from './events';
import { formatPKR } from './format';

export const EVENT_OPTIONS = EVENT_TYPES.map((e) => ({
  value: e.value,
  label: eventShort(e.value),
}));

export const BUDGETS = [30000, 40000, 50000, 75000];
export const BUDGET_OPTIONS = BUDGETS.map((b) => ({
  value: String(b),
  label: `Up to ${formatPKR(b)}`,
}));

export const DRONE_SORT_OPTIONS: { value: DroneSort; label: string }[] = [
  { value: 'popular', label: 'Most operators' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name', label: 'Name' },
];

export const OPERATOR_SORT_OPTIONS: { value: OperatorSort; label: string }[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'rating', label: 'Top rated' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'experience', label: 'Most experienced' },
];

/** Allow-list URL values so a hand-edited URL can't turn into an API 400 / error page. */
export const pick = <T extends string>(v: string | undefined, allowed: readonly T[]) =>
  v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
export const pickDroneSort = (v?: string) => pick(v, DRONE_SORTS);
export const pickOperatorSort = (v?: string) => pick(v, OPERATOR_SORTS);
export const pickSlug = (v?: string) => (v && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) ? v : undefined);
export const pickBudget = (v?: string) =>
  v && BUDGETS.includes(Number(v)) ? Number(v) : undefined;
export const pickPage = (v?: string) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 1 && n <= 1000 ? n : undefined;
};
export const pickQuery = (v?: string) => v?.trim().slice(0, 80) || undefined;
