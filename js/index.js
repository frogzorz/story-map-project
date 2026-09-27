import { createStoryControls } from './story-controls.js';
import { formatNumber, tractContent } from './tract-content.js';
import { renderCityChart } from './city-chart.js';
import { createStageTransition } from './stage-transition.js';
import { rateBins, unavailableColor, transitionColors, tractStyle, tractFillOpacity } from './map-styles.js';

const status = document.querySelector('#load-status');
const legend = document.querySelector('#map-legend');
const slides = document.querySelectorAll('.slide');
let mapStage;
const controls = createStoryControls(slides, (id, immediate) => {
  if (mapStage) mapStage(id, immediate);
  else {
    document.querySelector('#chart-panel').hidden = id !== 'citywide';
    document.querySelector('#map-panel').hidden = id === 'citywide';
  }
});
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

function tractDetails(feature) {
  const p = tractContent(feature.properties);
  const content = document.createElement('div');
  const lines = [
    p.name,
    `2020–2022: ${p.peakCount} shooting-victim occurrences; rate ${p.peakRate}`,
    `2023–2025: ${p.recentCount} shooting-victim occurrences; rate ${p.recentRate}`,
    'Rates: firearm injury rates per 10,000 resident population per year',
    `Fixed ACS 2020–2024 population: ${p.population}`,
    p.transition,
    p.notes,
  ];
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
    if (entry.label === 'Unavailable') swatch.style.borderStyle = 'dashed';
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
    const p = tractContent(feature.properties);
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = p.name;
    row.append(heading);
    const values = [p.population, p.peakCount, p.peakRate, p.recentCount, p.recentRate, p.transition, p.notes];
    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    fragment.append(row);
  }
  body.replaceChildren(fragment);
}

async function initialize() {
  try {
    // presentation uses only validated R exports
    const [collection, metadata, city] = await Promise.all([
      loadJSON('data/project1_tracts.geojson'),
      loadJSON('data/metadata.json'),
      loadJSON('data/city_year.json'),
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
    renderCityChart(document.querySelector('#city-chart'), city);
    if (!window.L) throw new Error('The map library did not load. Annual and tract tables are available; try reloading.');

    // context tiles sit beneath the tract polygons; classification stays in the R exports
    const map = L.map('map', { scrollWheelZoom: false, zoomSnap: 0.25 });
    const basemap = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      className: 'context-tiles',
      opacity: 0.8,
    });
    const tileStatus = document.querySelector('#tile-status');
    basemap.on('tileerror', () => {
      if (!tileStatus.hidden) return;
      tileStatus.textContent = 'Some basemap tiles could not load. Tract data and tables remain available.';
      tileStatus.hidden = false;
    });
    map.attributionControl.addAttribution('Philadelphia shooting data · US Census Bureau');
    // animate only this pane; context tiles and map controls remain steady
    const tractPane = map.createPane('tracts');
    tractPane.style.zIndex = 450;
    const dataLayer = L.geoJSON(collection, {
      pane: 'tracts',
      style: (feature) => tractStyle(feature.properties, 'peak_rate'),
      onEachFeature: (feature, layer) => layer.bindPopup(tractDetails(feature)),
    });
    const bounds = dataLayer.getBounds();
    if (!bounds.isValid()) throw new Error('The tract layer has no valid bounds.');
    const chartPanel = document.querySelector('#chart-panel');
    const mapPanel = document.querySelector('#map-panel');
    function fitMap() {
      if (controls.collapsed || mapPanel.hidden) return;
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [16, 16], animate: false });
    }
    function showStage(id) {
      const isChart = id === 'citywide';
      const wasMapHidden = mapPanel.hidden;
      const focused = document.activeElement;
      if ((isChart && mapPanel.contains(focused)) || (!isChart && chartPanel.contains(focused))
        || focused?.closest('.leaflet-popup')) controls.focusHeading(id);
      chartPanel.hidden = !isChart;
      mapPanel.hidden = isChart;
      map.closePopup();
      if (isChart) return;
      if (!controls.collapsed && !map.hasLayer(basemap)) basemap.addTo(map);
      if (id === 'orientation') {
        map.removeLayer(dataLayer);
        legend.replaceChildren();
        const heading = document.createElement('strong');
        heading.textContent = 'Philadelphia: geographic context';
        const description = document.createElement('p');
        // description.textContent = 'Basemap only';
        legend.append(heading, description);
      } else {
        dataLayer.setStyle((feature) => tractStyle(feature.properties, views[id].field));
        if (!map.hasLayer(dataLayer)) dataLayer.addTo(map);
        updateLegend(id);
      }
      if (wasMapHidden) fitMap();
    }
    const transitionToStage = createStageTransition(
      tractPane, showStage,
      window.matchMedia('(prefers-reduced-motion: reduce)'),
    );
    mapStage = (id, immediate) => transitionToStage(id, immediate || controls.collapsed);
    controls.onReveal = () => {
      mapStage(controls.currentId, true);
      fitMap();
    };
    mapStage(controls.currentId, true);
    fitMap();
    window.addEventListener('resize', () => {
      if (!mapPanel.hidden) fitMap();
    });
    status.textContent = `(Loaded ${city.length} annual counts and ${collection.features.length} tracts.)`;
  } catch (error) {
    status.textContent = `Some visuals are unavailable: ${error.message} Narrative and download links remain available.`;
    document.querySelector('#tile-status').hidden = false;
    document.querySelector('#tile-status').textContent = 'Map unavailable. Use the narrative, available tables and download links.';
    status.classList.add('error');
    console.error(error);
  }
}

initialize();
