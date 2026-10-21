import { createStoryControls } from './story-controls.js';
import { formatNumber, tractContent } from './tract-content.js';
import { popupOptions } from './map-popup.js';
import { renderCityChart } from './city-chart.js';
import { validateCity, validateTracts } from './data-validation.js';
import { createStageTransition } from './stage-transition.js';
import { initializeAddressSearch } from './address-search.js';
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

// plain-language summary for the address status; mirrors the popup and table wording
function tractSummary(properties) {
  const p = tractContent(properties);
  return `${p.name}. 2020–2022 rate: ${p.peakRate}; 2023–2025 rate: ${p.recentRate} per 10,000 residents per year. Category: ${p.transition}.`;
}

async function initializeMap() {
  // set once the map exists; address search still reports tract values without it
  let mapSelection = null;
  try {
    // presentation uses only validated R exports
    const [collection, metadata] = await Promise.all([
      loadJSON('data/project1_tracts.geojson'),
      loadJSON('data/metadata.json'),
    ]);
    validateTracts(collection, metadata);
    // narrative placeholders are optional; removing one must not prevent the map loading
    const benchmark = document.querySelector('#benchmark');
    if (benchmark) benchmark.textContent = formatNumber(metadata.benchmark_rate_10k, 2);
    document.querySelector('#extraction-date').textContent = metadata.data_extraction_date;
    document.querySelector('#transition-counts').textContent = Object.keys(transitionColors)
      .map((label) => `${label}: ${collection.features.filter((f) => f.properties.transition === label).length}`)
      .join('; ') + '.';
    populateTable(collection);
    const byGeoid = new Map(collection.features.map((f) => [f.properties.tract_geoid, f]));
    initializeAddressSearch(collection, (geoid) => {
      const feature = byGeoid.get(geoid);
      if (!feature) return null;
      const summary = tractSummary(feature.properties);
      const shown = mapSelection?.select(geoid);
      return shown ? summary : `${summary} Show the visualization to see the tract highlighted on the map.`;
    }, () => mapSelection?.clear());
    if (!window.L) throw new Error('The map library did not load. The tract table is available; try reloading.');

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
    // the highlighted tract follows its open popup, whether opened by a click or an address search
    let currentField = 'peak_rate';
    let selectedGeoid = null;
    let pendingGeoid = null;
    const styleTract = (feature) => tractStyle(feature.properties, currentField,
      feature.properties.tract_geoid === selectedGeoid);
    const dataLayer = L.geoJSON(collection, {
      pane: 'tracts',
      style: styleTract,
      onEachFeature: (feature, layer) => {
        layer.bindPopup(() => {
          const size = map.getSize();
          Object.assign(layer.getPopup().options, popupOptions(size.x, size.y));
          return tractDetails(feature);
        });
        layer.on('popupopen', () => {
          selectedGeoid = feature.properties.tract_geoid;
          layer.setStyle(styleTract(feature));
          layer.bringToFront();
        });
        layer.on('popupclose', () => {
          if (selectedGeoid !== feature.properties.tract_geoid) return;
          selectedGeoid = null;
          layer.setStyle(styleTract(feature));
        });
      },
    });
    const bounds = dataLayer.getBounds();
    if (!bounds.isValid()) throw new Error('The tract layer has no valid bounds.');
    function fitPopup(popup) {
      const size = map.getSize();
      Object.assign(popup.options, popupOptions(size.x, size.y));
      popup.update();
      const content = popup.getElement().querySelector('.leaflet-popup-content');
      content.tabIndex = 0;
      content.setAttribute('role', 'region');
      content.setAttribute('aria-label', 'Tract details; scroll to read all values and cautions');
    }
    map.on('popupopen', (event) => fitPopup(event.popup));
    const chartPanel = document.querySelector('#chart-panel');
    const mapPanel = document.querySelector('#map-panel');
    function fitMap() {
      if (controls.collapsed || mapPanel.hidden) return;
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [16, 16], animate: false });
      dataLayer.eachLayer((layer) => {
        if (layer.isPopupOpen()) fitPopup(layer.getPopup());
      });
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
        currentField = views[id].field;
        dataLayer.setStyle(styleTract);
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
    const tractLayer = (geoid) => dataLayer.getLayers().find((layer) => layer.feature.properties.tract_geoid === geoid);
    // zoom to the tract and open its popup exactly as a click would
    function showTract(geoid) {
      const layer = tractLayer(geoid);
      if (!layer || controls.collapsed || mapPanel.hidden || !map.hasLayer(dataLayer)) return false;
      map.fitBounds(layer.getBounds(), { padding: [24, 24], maxZoom: 15, animate: false });
      layer.openPopup();
      return true;
    }
    mapSelection = {
      select(geoid) {
        pendingGeoid = geoid;
        if (!showTract(geoid)) return false;
        pendingGeoid = null;
        return true;
      },
      clear() {
        pendingGeoid = null;
        map.closePopup();
        fitMap();
      },
    };
    const resetMap = document.querySelector('#map-reset');
    resetMap.addEventListener('click', () => {
      mapSelection.clear();
      document.querySelector('#stage-status').textContent = 'Map reset to Philadelphia’s full extent.';
    });
    resetMap.disabled = false;
    resetMap.hidden = false;
    controls.onReveal = () => {
      mapStage(controls.currentId, true);
      fitMap();
      if (pendingGeoid && showTract(pendingGeoid)) pendingGeoid = null;
    };
    mapStage(controls.currentId, true);
    fitMap();
    window.addEventListener('resize', () => {
      if (mapPanel.hidden) return;
      // keep a searched or clicked tract in view (e.g. when a phone keyboard closes)
      const selected = selectedGeoid && tractLayer(selectedGeoid);
      if (selected && !controls.collapsed) {
        map.invalidateSize();
        map.fitBounds(selected.getBounds(), { padding: [24, 24], maxZoom: 15, animate: false });
        if (selected.isPopupOpen()) fitPopup(selected.getPopup());
      } else fitMap();
    });
    return `${collection.features.length} tracts`;
  } catch (error) {
    document.querySelector('#tile-status').hidden = false;
    document.querySelector('#tile-status').textContent = 'Map unavailable. Use the narrative, available tables and download links.';
    throw error;
  }
}

async function initializeCity() {
  try {
    const city = validateCity(await loadJSON('data/city_year.json'));
    renderCityChart(document.querySelector('#city-chart'), city);
    return `${city.length} annual counts`;
  } catch (error) {
    const message = document.createElement('p');
    message.className = 'error';
    message.textContent = 'Citywide chart and annual table unavailable. Try reloading or use the download link.';
    document.querySelector('#city-chart').replaceChildren(message);
    throw error;
  }
}

async function initialize() {
  const results = await Promise.allSettled([initializeCity(), initializeMap()]);
  const loaded = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
  const failed = results.filter((result) => result.status === 'rejected').map((result) => result.reason.message);
  status.classList.toggle('error', failed.length > 0);
  status.textContent = failed.length
    ? `Some visuals are unavailable: ${failed.join(' ')} ${loaded.length ? `Loaded ${loaded.join(' and ')}.` : ''} Narrative and download links remain available.`
    : `(Loaded ${loaded.join(' and ')}.)`;
}

initialize();
