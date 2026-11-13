import { EVENT_TYPES, type EventType } from '@video-lamhe/shared';

export const eventLabel = (e: EventType) => EVENT_TYPES.find((x) => x.value === e)?.label ?? e;
/** Short labels for chips/badges ("Outdoor / Pre-wedding shoot" → "Pre-wedding"). */
export const eventShort = (e: EventType) => (e === 'outdoor' ? 'Pre-wedding' : eventLabel(e));
