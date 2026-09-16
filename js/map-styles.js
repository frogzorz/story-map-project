// display bins only: these do not determine elevated-burden status
const rateBins = [
  { minimum: 0, label: '0 to <5', color: '#440154' },
  { minimum: 5, label: '5 to <10', color: '#414487' },
  { minimum: 10, label: '10 to <20', color: '#2A788E' },
  { minimum: 20, label: '20 to <40', color: '#22A884' },
  { minimum: 40, label: '40 to <80', color: '#7AD151' },
  { minimum: 80, label: '80 or more', color: '#FDE725' },
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
  return { color: '#FFFFFF', weight: 0.6, fillOpacity: tractFillOpacity, fillColor };
}

export { rateBins, unavailableColor, transitionColors, rateColor, tractStyle, tractFillOpacity };
