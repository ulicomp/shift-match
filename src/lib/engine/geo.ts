/** Straight-line distance × 1.3 road factor ≈ Miami driving miles. */
export function drivingMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  const miles = 2 * R * Math.asin(Math.sqrt(h)) * 1.3;
  return Math.max(0.4, Math.round(miles * 10) / 10);
}
