/**
 * Seed data. Everything sample is clearly marked — no real business data.
 * Drone specs are placeholders the admin edits (Section 10). Prices are SAMPLE values
 * so the budget filter can be tried; replace them before launch.
 */
export const SEED_DRONES = [
  { name: 'DJI Air 2', slug: 'dji-air-2', sortOrder: 1 },
  { name: 'DJI Air 2S', slug: 'dji-air-2s', sortOrder: 2 },
  { name: 'DJI Air 3', slug: 'dji-air-3', sortOrder: 3 },
  { name: 'DJI Air 3S', slug: 'dji-air-3s', sortOrder: 4 },
].map((d) => ({
  ...d,
  tag: null,
  bestFor: '[Best for — edit in Admin → Drones]',
  specs: {
    camera: '[Camera — edit in admin]',
    video: '[Video — edit in admin]',
    flightTime: '[Flight time — edit in admin]',
    range: '[Range — edit in admin]',
  },
  images: [] as string[],
}));

/** [base city, ...also serves], drones as [slug, SAMPLE price per event, SAMPLE price per hour] */
export const SEED_OPERATORS: {
  n: number;
  base: string;
  serves: string[];
  drones: [string, number, number][];
  status: 'active' | 'pending';
  verified: boolean;
  years: number;
}[] = [
  {
    n: 1,
    base: 'karachi',
    serves: ['hyderabad'],
    drones: [
      ['dji-air-2s', 35000, 8000],
      ['dji-air-3', 45000, 10000],
    ],
    status: 'active',
    verified: true,
    years: 6,
  },
  {
    n: 2,
    base: 'lahore',
    serves: ['gujranwala', 'sialkot'],
    drones: [['dji-air-3s', 55000, 12000]],
    status: 'active',
    verified: true,
    years: 5,
  },
  {
    n: 3,
    base: 'islamabad',
    serves: ['rawalpindi'],
    drones: [
      ['dji-air-2', 25000, 6000],
      ['dji-air-2s', 32000, 7500],
    ],
    status: 'active',
    verified: false,
    years: 3,
  },
  {
    n: 4,
    base: 'multan',
    serves: [],
    drones: [['dji-air-2s', 30000, 7000]],
    status: 'active',
    verified: false,
    years: 2,
  },
  {
    n: 5,
    base: 'faisalabad',
    serves: ['multan'],
    drones: [['dji-air-3', 42000, 9500]],
    status: 'active',
    verified: true,
    years: 4,
  },
  // Pending: shows up in the admin approval queue, not on public pages.
  {
    n: 6,
    base: 'peshawar',
    serves: [],
    drones: [['dji-air-3', 40000, 9000]],
    status: 'pending',
    verified: false,
    years: 1,
  },
];

/**
 * 12 SAMPLE shorts for local dev, using Cloudinary's public *demo* account videos
 * (not our account — never deleted by us, never seeded in --prod).
 */
const DEMO = ['dog', 'sea_turtle', 'elephants', 'samples/cld-sample-video'] as const;
const EVENTS = ['barat', 'mehndi', 'walima', 'nikah', 'outdoor', 'barat'] as const;

export const SEED_SHORTS = Array.from({ length: 12 }, (_, i) => {
  const demo = DEMO[i % DEMO.length]!;
  return {
    n: i + 1,
    operatorN: (i % 5) + 1, // sample operators 1–5 (all active)
    eventType: EVENTS[i % EVENTS.length]!,
    isFeatured: i < 4,
    videoUrl: `https://res.cloudinary.com/demo/video/upload/q_auto,f_auto,w_720,du_60,ac_none/${demo}`,
    thumbnailUrl: `https://res.cloudinary.com/demo/video/upload/so_1,w_480,q_auto/${demo}.jpg`,
  };
});
