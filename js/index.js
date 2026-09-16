import { SlideDeck } from './slidedeck.js';
import { rateBins, unavailableColor, transitionColors, tractStyle, tractFillOpacity } from './map-styles.js';

const status = document.querySelector('#load-status');
const legend = document.querySelector('#map-legend');
const slides = document.querySelectorAll('.slide');
const views = {
  'peak': { field: 'peak_rate', title: '2020–2022: peak period' },
  'recent': { field: 'recent_rate', title: '2023–2025: recent decline' },
  'transitions': { field: 'transition', title: '2020–2022 → 2023–2025' },
};

async function loadJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path} (HTTP ${response.status}).`);
  return response.json();
}

function formatNumber(value, digits = 0) {
  return Number.isFinite(value)
    ? value.toLocaleString('en-US', { maximumFractionDigits: digits })
    : 'Unavailable';
}

function tractDetails(feature) {
  const p = feature.properties;
  const content = document.createElement('div');
  const lines = [
    `Tract ${p.tract_name} (${p.tract_geoid})`,
    `2020–2022: ${formatNumber(p.peak_count)} shootings; rate ${formatNumber(p.peak_rate, 2)}`,
    `2023–2025: ${formatNumber(p.recent_count)} shootings; rate ${formatNumber(p.recent_rate, 2)}`,
    'Rates: firearm injury rates per 10,000 resident population per year',
    `Fixed population: ${formatNumber(p.fixed_population)}`,
    p.transition,
  ];
  if (p.low_population_flag) lines.push('Caution: fewer than 100 residents.');
  if (p.low_count_flag) lines.push('Caution: low event count in at least one period.');
  if (p.rate_exclusion_reason) lines.push(`Rate unavailable: ${p.rate_exclusion_reason}. Counts are retained.`);
  if (p.zero_population_flag || p.missing_denominator_flag) {
    lines.push('Rate unavailable because population is zero or missing. Counts are retained.');
  }
  for (const line of lines) {
    const paragraph = document.createElement('p');
    paragraph.textContent = line;
    content.append(paragraph);
  }
  return content;
}

function updateLegend(slideId) {
  const view = views[slideId];
  legend.replaceChildren();
  const heading = document.createElement('strong');
  heading.textContent = view.title;
  legend.append(heading);
  const description = document.createElement('p');
  description.textContent = view.field === 'transition'
    ? 'Baseline set at 75th percentile of 2015–2019 tract rates.'
    : 'Firearm injury rates per 10,000 residents per year. Unavailable includes special-use tracts.';
  legend.append(description);
  const entries = view.field === 'transition'
    ? Object.entries(transitionColors).map(([label, color]) => ({ label, color }))
    : [...rateBins, { label: 'Unavailable', color: unavailableColor }];
  const list = document.createElement('ul');
  for (const entry of entries) {
    const item = document.createElement('li');
    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.style.backgroundColor = entry.color;
    swatch.style.opacity = tractFillOpacity;
    swatch.setAttribute('aria-hidden', 'true');
    item.append(swatch, document.createTextNode(entry.label));
    list.append(item);
  }
  legend.append(list);
}

function populateTable(collection) {
  const body = document.querySelector('#tract-table-body');
  const fragment = document.createDocumentFragment();
  for (const feature of collection.features) {
    const p = feature.properties;
    const row = document.createElement('tr');
    const values = [p.tract_geoid, formatNumber(p.peak_count), formatNumber(p.peak_rate, 2),
      formatNumber(p.recent_count), formatNumber(p.recent_rate, 2), p.transition];
    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    fragment.append(row);
  }
  body.append(fragment);
}

async function initialize() {
  try {
    // both requests finish before the scroll listener is attached
    const [collection, metadata] = await Promise.all([
      loadJSON('data/project1_tracts.geojson'),
      loadJSON('data/metadata.json'),
    ]);
    if (collection.type !== 'FeatureCollection' || !collection.features?.length) {
      throw new Error('The tract export is empty or is not a GeoJSON FeatureCollection.');
    }
    const required = ['tract_geoid', 'tract_name', 'peak_count', 'peak_rate',
      'recent_count', 'recent_rate', 'transition', 'fixed_population'];
    const seen = new Set();
    for (const feature of collection.features) {
      const p = feature.properties;
      if (!['Polygon', 'MultiPolygon'].includes(feature.geometry?.type)
        || !p || required.some((key) => !Object.hasOwn(p, key))
        || seen.has(p.tract_geoid) || !Object.hasOwn(transitionColors, p.transition)) {
        throw new Error('The tract export has invalid geometry types, fields, IDs, or categories.');
      }
      seen.add(p.tract_geoid);
    }
    if (!Number.isFinite(metadata.benchmark_rate_10k) || metadata.baseline_percentile !== 0.75) {
      throw new Error('The metadata does not describe the expected baseline benchmark.');
    }
    // narrative placeholders are optional; removing one must not prevent the map loading
    const benchmark = document.querySelector('#benchmark');
    if (benchmark) benchmark.textContent = formatNumber(metadata.benchmark_rate_10k, 2);
    document.querySelector('#extraction-date').textContent = metadata.data_extraction_date;
    document.querySelector('#transition-counts').textContent = Object.keys(transitionColors)
      .map((label) => `${label}: ${collection.features.filter((f) => f.properties.transition === label).length}`)
      .join('; ') + '.';
    populateTable(collection);
    if (!window.L) throw new Error('Leaflet did not load. The table is available; check your internet connection and reload.');

    // context tiles sit beneath the tract polygons; classification stays in the R exports
    const map = L.map('map', { scrollWheelZoom: false, zoomSnap: 0.25 });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      className: 'context-tiles',
      opacity: 0.8,
    }).addTo(map);
    map.attributionControl.addAttribution('Philadelphia shooting data · US Census Bureau');
    const slideOptions = {};
    for (const [id, view] of Object.entries(views)) {
      slideOptions[id] = {
        style: (feature) => tractStyle(feature.properties, view.field),
        onEachFeature: (feature, layer) => layer.bindPopup(tractDetails(feature)),
      };
    }
    updateLegend(slides[0].id);
    const deck = new SlideDeck(slides, map, collection, slideOptions, updateLegend);
    document.addEventListener('scroll', () => deck.calcCurrentSlideIndex(), { passive: true });
    window.addEventListener('resize', () => {
      deck.fitMap();
      deck.calcCurrentSlideIndex();
    });
    status.textContent = `Loaded ${collection.features.length} tracts. Click a tract to see details.`;
  } catch (error) {
    status.textContent = `Map unavailable: ${error.message} Fix the problem and reload the page.`;
    status.classList.add('error');
    console.error(error);
  }
}

initialize();
