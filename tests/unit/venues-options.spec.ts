// Venue choices: old saved type/status names read as today's, the amenities sanitizer, and that reading
// never rewrites the store (old free-text tags go only when that venue is next saved).
import { expect, test } from '@playwright/test';
import { amenityOf, cleanAmenities, readVenueInfo, readVenueStatus, readVenueType, toggleAmenity, VENUE_AMENITIES, VENUE_STATUSES, VENUE_TYPES } from '../../src/lib/venues/options';
import { allVenueInfo, cleanVenueInfo, saveVenueInfo } from '../../src/lib/venues/info';
import { getJSON, setJSON } from '../../src/lib/store';

// The in-memory store, never Upstash.
for (const k of ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']) delete process.env[k];

test('the choices are exactly the Events team’s', () => {
  expect([...VENUE_STATUSES]).toEqual(['Renting', 'Not Renting']);
  expect([...VENUE_TYPES]).toEqual(['Hotel', 'Association', 'Home Builder', 'Convention Center', 'Apartment Association']);
  expect(VENUE_AMENITIES).toHaveLength(10);
});

test('old statuses read as today’s: Not Available → Not Renting, Not contacted yet → no status', () => {
  expect(readVenueStatus('Not Available')).toBe('Not Renting');
  expect(readVenueStatus('Not contacted yet')).toBeUndefined();
  expect(readVenueStatus('Renting')).toBe('Renting');
  expect(readVenueStatus('Not Renting')).toBe('Not Renting');
  expect(readVenueStatus('Maybe')).toBeUndefined();
  expect(readVenueStatus(undefined)).toBeUndefined();
});

test('old types read as today’s: Realtor Association → Association, Builders Association → Home Builder', () => {
  expect(readVenueType('Realtor Association')).toBe('Association');
  expect(readVenueType('Builders Association')).toBe('Home Builder');
  expect(readVenueType('Hotel')).toBe('Hotel');
  expect(readVenueType('Convention Center')).toBe('Convention Center');
  expect(readVenueType('Apartment Association')).toBe('Apartment Association');
  expect(readVenueType('Church')).toBeUndefined();
});

test('readVenueInfo maps names, respells matching tags, keeps the rest and the description', () => {
  const r = readVenueInfo({ status: 'Not contacted yet', type: 'Realtor Association', tags: ['free PARKING', 'big room', 'Free parking'], description: 'Old note', notes: 'n' });
  expect(r).toEqual({ type: 'Association', tags: ['Free parking', 'big room'], description: 'Old note', notes: 'n' });
  expect('status' in r).toBe(false);
});

test('the amenities sanitizer keeps only the options, spelled as the option, in the list’s order', () => {
  expect(amenityOf('  coi   NEEDED ')).toBe('COI needed');
  expect(amenityOf('parking')).toBeUndefined();
  expect(cleanAmenities(['microphone', 'Free parking', 'wifi', 'Easel', 'easel', 42, null])).toEqual(['Free parking', 'Easel', 'Microphone']);
  expect(cleanAmenities('Free parking')).toEqual([]);
  expect(cleanAmenities(undefined)).toEqual([]);
});

test('Coffee included and No coffee never both stay', () => {
  expect(cleanAmenities(['No coffee', 'Coffee included'])).toEqual(['No coffee']);
  expect(cleanAmenities(['coffee included', 'no coffee', 'Easel'])).toEqual(['Coffee included', 'Easel']);
  expect(toggleAmenity(['Coffee included', 'Easel'], 'No coffee')).toEqual(['No coffee', 'Easel']);
  expect(toggleAmenity(['No coffee'], 'Coffee included')).toEqual(['Coffee included']);
  expect(toggleAmenity(['Easel', 'Microphone'], 'Easel')).toEqual(['Microphone']);
});

test('cleanVenueInfo: only known status/type values, only amenities in tags, description still accepted', () => {
  const c = cleanVenueInfo({ status: 'Not Available', type: 'Realtor Association', tags: ['big room', 'av INCLUDED'], description: ' kept ' });
  expect(c.status).toBeUndefined();
  expect(c.type).toBeUndefined();
  expect(c.tags).toEqual(['AV included']);
  expect(c.description).toBe('kept');
  expect(cleanVenueInfo({ status: 'Renting', type: 'Home Builder', tags: ['wifi'] })).toMatchObject({ status: 'Renting', type: 'Home Builder', tags: undefined });
});

test('reading old data doesn’t rewrite the store; old tags go only from the venue that is saved', async () => {
  const stored = {
    a: { status: 'Not Available', type: 'Builders Association', tags: ['Projector', 'free parking'], updatedAt: 5 },
    b: { status: 'Not contacted yet', tags: ['old tag'], description: 'room for 40', updatedAt: 7 },
  };
  await setJSON('venues:info', stored);
  const read = await allVenueInfo();
  expect(read.a).toEqual({ status: 'Not Renting', type: 'Home Builder', tags: ['Projector', 'Free parking'], updatedAt: 5 });
  expect(read.b).toEqual({ tags: ['old tag'], description: 'room for 40', updatedAt: 7 });
  expect(await getJSON('venues:info', {})).toEqual(stored);

  // Saving venue a (as the page sends it back) keeps the mapped names, drops its unknown tag, leaves b alone.
  const { updatedAt, ...draft } = read.a;
  const saved = await saveVenueInfo('a', cleanVenueInfo({ ...draft, notes: 'called' }), 'andrea', updatedAt);
  expect(saved).toMatchObject({ status: 'Not Renting', type: 'Home Builder', tags: ['Free parking'], notes: 'called', updatedBy: 'andrea' });
  const after = await getJSON<Record<string, unknown>>('venues:info', {});
  expect(after.b).toEqual(stored.b);

  // Saving b keeps its hidden description.
  const { updatedAt: ub, ...draftB } = read.b;
  const savedB = await saveVenueInfo('b', cleanVenueInfo({ ...draftB, status: 'Renting' }), 'andrea', ub);
  expect(savedB).toMatchObject({ status: 'Renting', description: 'room for 40' });
  expect(savedB.tags).toBeUndefined();
});
