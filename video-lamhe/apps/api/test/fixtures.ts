import { City } from '../src/models/City';
import { DroneModel } from '../src/models/DroneModel';

export async function seedCatalog() {
  const [karachi, lahore, hyderabad, quetta] = await City.create([
    { name: 'Karachi', slug: 'karachi', province: 'Sindh' },
    { name: 'Lahore', slug: 'lahore', province: 'Punjab' },
    { name: 'Hyderabad', slug: 'hyderabad', province: 'Sindh' },
    { name: 'Quetta', slug: 'quetta', province: 'Balochistan', isActive: false },
  ]);
  const [air2s, air3] = await DroneModel.create([
    { name: 'DJI Air 2S', slug: 'dji-air-2s', sortOrder: 2 },
    { name: 'DJI Air 3', slug: 'dji-air-3', sortOrder: 3 },
  ]);
  return {
    karachi: karachi!,
    lahore: lahore!,
    hyderabad: hyderabad!,
    quetta: quetta!,
    air2s: air2s!,
    air3: air3!,
  };
}
