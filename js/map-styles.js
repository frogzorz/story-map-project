// reversed rocket, range 0.50–0.95; darkest endpoint adjusted to dark red
// display colors only: bins and analytic rates are unchanged
const rateBins = [
  { minimum: 0, label: '0 to <5', color: '#F8D7C1' },
  { minimum: 5, label: '5 to <10', color: '#F6B490' },
  { minimum: 10, label: '10 to <20', color: '#F58F66' },
  { minimum: 20, label: '20 to <40', color: '#F16646' },
  { minimum: 40, label: '40 to <80', color: '#E53A40' },
  { minimum: 80, label: '80 or more', color: '#9E1B32' },
];
const unavailableColor = '#777777';
const tractFillOpacity = 0.75;
const transitionColors = {
  'Persistently elevated': '#7A0177',
  'Previously elevated': '#D95F02',
  'Newly elevated': '#1B9E77',
  'Consistently below': '#D9D9D9',
  'Unavailable': unavailableColor,
};

function rateColor(value) {
  if (!Number.isFinite(value) || value < 0) return unavailableColor;
  let color = rateBins[0].color;
  for (const bin of rateBins) {
    if (value >= bin.minimum) color = bin.color;
  }
  return color;
}

function tractStyle(properties, view) {
  const fillColor = view === 'transition'
    ? (transitionColors[properties.transition] || unavailableColor)
    : rateColor(properties[view]);
  const unavailable = fillColor === unavailableColor;
  return {
    color: unavailable ? '#333333' : '#FFFFFF',
    weight: unavailable ? 1 : 0.6,
    dashArray: unavailable ? '3 3' : null,
    fillOpacity: tractFillOpacity,
    fillColor,
  };
}

export { rateBins, unavailableColor, transitionColors, rateColor, tractStyle, tractFillOpacity };
