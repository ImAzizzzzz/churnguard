import { describe, it, expect } from 'vitest'
import { riskLabel, formatTenure, formatCurrency } from './format'

describe('riskLabel', () => {
  it('translates French segments to English', () => {
    expect(riskLabel('Élevé')).toBe('High')
    expect(riskLabel('Moyen')).toBe('Medium')
    expect(riskLabel('Faible')).toBe('Low')
  })
  it('passes through English values', () => {
    expect(riskLabel('High')).toBe('High')
  })
  it('handles empty/null', () => {
    expect(riskLabel(null)).toBe('—')
    expect(riskLabel('')).toBe('—')
  })
})

describe('formatTenure', () => {
  it('returns a dash for invalid input', () => {
    expect(formatTenure(null)).toBe('—')
    expect(formatTenure('abc')).toBe('—')
    expect(formatTenure(-1)).toBe('—')
  })
  it('formats whole years (compact)', () => {
    expect(formatTenure(6, 'compact')).toContain('6 yr')
  })
  it('short mode abbreviates', () => {
    expect(formatTenure(2, 'short')).toMatch(/^2y/)
  })
})

describe('formatCurrency', () => {
  it('returns a dash for null/NaN', () => {
    expect(formatCurrency(null)).toBe('—')
    expect(formatCurrency('xyz')).toBe('—')
  })
  it('formats with thousands separators and currency', () => {
    expect(formatCurrency(1250000)).toBe('1,250,000 TND')
  })
  it('compact abbreviates large numbers', () => {
    expect(formatCurrency(1250000, 'TND', { compact: true })).toBe('1.3M TND')
    expect(formatCurrency(850000, 'TND', { compact: true })).toBe('850K TND')
  })
  it('respects custom currency', () => {
    expect(formatCurrency(100, 'USD')).toBe('100 USD')
  })
})
