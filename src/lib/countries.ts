export interface Country {
  name: string;
  code: string;
  latitude: number;
  longitude: number;
}

export const countries: Country[] = [
  { name: 'Test Site', code: 'TS', latitude: 0, longitude: 0 },
  { name: 'United States', code: 'US', latitude: 37.0902, longitude: -95.7129 },
  { name: 'United Kingdom', code: 'GB', latitude: 55.3781, longitude: -3.4360 },
  { name: 'Canada', code: 'CA', latitude: 56.1304, longitude: -106.3468 },
  { name: 'Australia', code: 'AU', latitude: -25.2744, longitude: 133.7751 },
  { name: 'Germany', code: 'DE', latitude: 51.1657, longitude: 10.4515 },
  { name: 'France', code: 'FR', latitude: 46.2276, longitude: 2.2137 },
  { name: 'Japan', code: 'JP', latitude: 36.2048, longitude: 138.2529 },
  { name: 'India', code: 'IN', latitude: 20.5937, longitude: 78.9629 },
  { name: 'Brazil', code: 'BR', latitude: -14.2350, longitude: -51.9253 },
  { name: 'South Africa', code: 'ZA', latitude: -30.5595, longitude: 22.9375 },
];
