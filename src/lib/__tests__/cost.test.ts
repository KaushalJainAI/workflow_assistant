import { describe, it, expect } from 'vitest';

import { describeCost, formatCost, formatCostUsd, UNPRICED_LABEL } from '../cost';

describe('formatCost', () => {
  it('never renders an unpriced run as a number', () => {
    // The property this module exists for: no price on record is not zero,
    // and printing ₹0.00 there claims a run was free when we do not know.
    expect(formatCost('0', 'unpriced')).toBe(UNPRICED_LABEL);
    expect(formatCost('1.50', 'unpriced')).toBe(UNPRICED_LABEL);
  });

  it('renders a genuinely free run as zero', () => {
    expect(formatCost('0', 'estimated')).toBe('₹0');
  });

  it('keeps sub-paisa amounts visible rather than rounding them away', () => {
    // A cheap turn really does cost a fraction of a paisa. A column of ₹0.00
    // that nonetheless sums to something is worse than small numbers.
    expect(formatCost('0.00005', 'estimated')).toBe('₹0.004');
  });

  it('converts dollars to rupees at the documented rate', () => {
    expect(formatCost('1.00', 'billed')).toBe('₹88.00');
  });

  it('drops decimals once the figure is large enough not to need them', () => {
    expect(formatCost('100', 'estimated')).toBe('₹8,800');
  });

  it('treats a malformed cost as zero rather than NaN', () => {
    expect(formatCost('not-a-number', 'estimated')).toBe('₹0');
    expect(formatCost(null, 'estimated')).toBe('₹0');
    expect(formatCost(undefined, 'billed')).toBe('₹0');
  });
});

describe('formatCostUsd', () => {
  it('shows enough places for a cost that would otherwise read as zero', () => {
    expect(formatCostUsd('0.000031')).toBe('$0.000031');
    expect(formatCostUsd('1.5')).toBe('$1.5000');
  });
});

describe('describeCost', () => {
  it('says a cost is unknown rather than describing a zero', () => {
    expect(describeCost('0', 'unpriced')).toMatch(/unknown, not zero/);
  });

  it('distinguishes what the provider charged from what we estimated', () => {
    expect(describeCost('0.01', 'billed')).toMatch(/^Charged by the provider/);
    expect(describeCost('0.01', 'estimated')).toMatch(/^Estimated/);
  });

  it('breaks the tokens out, calling the cached ones out separately', () => {
    const text = describeCost('0.01', 'estimated', {
      input_tokens: 200,
      output_tokens: 100,
      cached_read_tokens: 800,
      cached_write_tokens: 0,
    });
    expect(text).toContain('200 in + 800 cached');
    expect(text).toContain('100 out');
  });

  it('omits the cache clause when nothing was cached', () => {
    const text = describeCost('0.01', 'estimated', {
      input_tokens: 200,
      output_tokens: 100,
      cached_read_tokens: 0,
      cached_write_tokens: 0,
    });
    expect(text).toContain('200 in ');
    expect(text).not.toContain('cached');
  });
});
