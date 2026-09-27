export function formatNumber(value, digits = 0) {
  return Number.isFinite(value)
    ? value.toLocaleString('en-US', { maximumFractionDigits: digits })
    : 'Unavailable';
}

export function tractContent(p) {
  const notes = [];
  if (p.low_population_flag) notes.push('Caution: fewer than 100 residents.');
  if (p.low_count_flag) notes.push('Caution: low event count in at least one period.');
  if (p.rate_exclusion_reason) notes.push(`Rate unavailable: ${p.rate_exclusion_reason}. Counts are retained.`);
  if (p.zero_population_flag || p.missing_denominator_flag) {
    notes.push('Rate unavailable because population is zero or missing. Counts are retained.');
  }
  return {
    name: `Tract ${p.tract_name} (${p.tract_geoid})`,
    population: formatNumber(p.fixed_population),
    peakCount: formatNumber(p.peak_count), peakRate: formatNumber(p.peak_rate, 2),
    recentCount: formatNumber(p.recent_count), recentRate: formatNumber(p.recent_rate, 2),
    transition: p.transition,
    notes: notes.join(' ') || 'No listed cautions; estimates still have uncertainty.',
  };
}
