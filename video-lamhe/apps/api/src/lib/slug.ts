export function slugify(input: string): string {
  return (
    input
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70) || 'item'
  );
}

/** Any model with a `slug` field (only `exists` is needed). */
interface SlugModel {
  exists(filter: Record<string, unknown>): PromiseLike<unknown>;
}

/** First free slug: 'karachi', 'karachi-2', 'karachi-3', … */
export async function uniqueSlug(
  model: SlugModel,
  base: string,
  excludeId?: unknown,
): Promise<string> {
  const root = slugify(base);
  for (let n = 1; n < 1000; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    const filter: Record<string, unknown> = { slug: candidate };
    if (excludeId) filter._id = { $ne: excludeId };
    if (!(await model.exists(filter))) return candidate;
  }
  throw new Error('Could not generate a unique slug');
}

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
