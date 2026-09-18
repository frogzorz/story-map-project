// chart coordinates are presentation only; all counts come from R
function chartLayout(rows) {
  if (!Array.isArray(rows) || rows.length !== 11
    || rows.some((row, i) => row.year !== 2015 + i
      || !Number.isInteger(row.total) || row.total < 0)) {
    throw new Error('City data must contain annual victim counts for 2015–2025.');
  }
  const maximum = Math.max(500, Math.ceil(Math.max(...rows.map((r) => r.total)) / 500) * 500);
  const x = (year) => 65 + (year - 2014.5) / 11 * 600;
  const y = (total) => 310 - total / maximum * 240;
  return { maximum, x, y, points: rows.map((row) => ({ ...row, x: x(row.year), y: y(row.total) })) };
}

function svgElement(tag, attributes, text) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderCityChart(container, rows) {
  const { maximum, x, y, points } = chartLayout(rows);
  const svg = svgElement('svg', { 'viewBox': '0 0 700 370', 'role': 'img', 'aria-labelledby': 'city-chart-title city-chart-description' });
  svg.append(svgElement('title', { id: 'city-chart-title' }, 'Philadelphia shooting victims, 2015–2025'));
  svg.append(svgElement('desc', { id: 'city-chart-description' },
    'Annual counts, including fatal and nonfatal victims, excluding officer-involved shootings. Exact values are in the annual-count table.'));
  for (const [start, end, label, color] of [
    [2014.5, 2019.5, 'Baseline', '#E6EFF5'],
    [2019.5, 2022.5, 'Peak', '#FAEBDD'],
    [2022.5, 2025.5, 'Recent decline', '#E4F0E9'],
  ]) {
    svg.append(svgElement('rect', { x: x(start), y: 55, width: x(end) - x(start), height: 255, fill: color }));
    svg.append(svgElement('text', { 'x': (x(start) + x(end)) / 2, 'y': 42, 'text-anchor': 'middle' }, label));
  }
  for (let count = 0; count <= maximum; count += 500) {
    svg.append(svgElement('line', { x1: 65, x2: 665, y1: y(count), y2: y(count), stroke: '#FFFFFF' }));
    svg.append(svgElement('text', { 'x': 57, 'y': y(count) + 5, 'text-anchor': 'end' }, count.toLocaleString('en-US')));
  }
  svg.append(svgElement('polyline', { 'points': points.map((p) => `${p.x},${p.y}`).join(' '), 'fill': 'none', 'stroke': '#145B80', 'stroke-width': 3 }));
  for (const point of points) {
    const circle = svgElement('circle', { cx: point.x, cy: point.y, r: 4, fill: '#145B80' });
    circle.append(svgElement('title', {}, `${point.year}: ${point.total.toLocaleString('en-US')} victims`));
    svg.append(circle);
    svg.append(svgElement('text', { 'x': point.x, 'y': 334, 'text-anchor': 'middle', 'class': 'chart-year' }, point.year));
  }
  container.replaceChildren(svg);
  const body = document.querySelector('#city-table-body');
  body.replaceChildren();
  for (const row of rows) {
    const tr = document.createElement('tr');
    for (const field of ['year', 'total', 'fatal', 'nonfatal']) {
      const cell = document.createElement(field === 'year' ? 'th' : 'td');
      if (field === 'year') cell.scope = 'row';
      cell.textContent = field === 'year' ? row[field] : row[field].toLocaleString('en-US');
      tr.append(cell);
    }
    body.append(tr);
  }
}

export { chartLayout, renderCityChart };
