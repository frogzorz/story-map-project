import { transitionColors } from './map-styles.js';

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

const count = (value) => Number.isInteger(value) && value >= 0;
const nullableNumber = (value) => value === null || (Number.isFinite(value) && value >= 0);

export function validateCity(city) {
  requireValue(Array.isArray(city) && city.length === 11, 'Expected 11 citywide years.');
  city.forEach((row, i) => {
    requireValue(row.year === 2015 + i && [row.total, row.fatal, row.nonfatal].every(count)
      && row.total === row.fatal + row.nonfatal, 'Invalid citywide years or victim counts.');
    requireValue(row.period === (row.year <= 2019 ? 'baseline' : row.year <= 2022 ? 'peak' : 'recent_decline'), 'Unexpected citywide period.');
  });
  return city;
}

export function validateTracts(collection, metadata) {
  requireValue(metadata?.baseline_percentile === 0.75 && Number.isFinite(metadata.benchmark_rate_10k)
    && metadata.benchmark_rate_10k > 0 && typeof metadata.generation_timestamp === 'string'
    && metadata.generation_timestamp.length > 0, 'Metadata must describe the fixed baseline benchmark and generation timestamp.');
  requireValue(collection?.type === 'FeatureCollection' && collection.features?.length === 408, 'Expected 408 Philadelphia tract polygons.');
  const ids = new Set();
  for (const feature of collection.features) {
    const p = feature.properties;
    requireValue(['Polygon', 'MultiPolygon'].includes(feature.geometry?.type)
      && Array.isArray(feature.geometry.coordinates) && feature.geometry.coordinates.length > 0,
    'Tract export must contain polygon coordinates, never event points.');
    requireValue(p && /^42101\d{6}$/.test(p.tract_geoid) && !ids.has(p.tract_geoid), 'Invalid or duplicated tract GEOID.');
    ids.add(p.tract_geoid);
    requireValue(typeof p.tract_name === 'string' && [p.peak_count, p.recent_count].every(count)
      && [p.fixed_population, p.peak_rate, p.recent_rate].every(nullableNumber)
      && Object.hasOwn(transitionColors, p.transition), 'Invalid tract counts, rates, population or category.');
    requireValue(Number.isFinite(p.benchmark_rate_10k)
      && Math.abs(p.benchmark_rate_10k - metadata.benchmark_rate_10k) < 1e-10, 'Tract and metadata benchmarks disagree.');
    if (!(p.fixed_population > 0) || p.special_use_flag) {
      requireValue(p.peak_rate === null && p.recent_rate === null && p.transition === 'Unavailable', 'Ineligible tract has an available rate or classification.');
    }
  }
  return collection;
}
