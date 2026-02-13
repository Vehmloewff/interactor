import { describe, expect, test } from 'bun:test'

import { parseJsonArray, parseJsonObject, sanitizeForTransport } from '../events/method-utils'

describe('events/method-utils', () => {
  test('parseJsonObject parses valid JSON object', () => {
    expect(parseJsonObject('{"a":1}', 'field')).toEqual({ a: 1 })
  })

  test('parseJsonObject rejects arrays', () => {
    expect(() => parseJsonObject('[1,2]', 'field')).toThrow()
  })

  test('parseJsonArray parses valid JSON array', () => {
    expect(parseJsonArray('[1,2,3]', 'field')).toEqual([1, 2, 3])
  })

  test('parseJsonArray rejects objects', () => {
    expect(() => parseJsonArray('{"a":1}', 'field')).toThrow()
  })

  test('sanitizeForTransport handles circular refs and primitive conversions', () => {
    const source: Record<string, unknown> = {
      big: 10n,
      fn: () => 'x',
      date: new Date('2024-01-01T00:00:00.000Z'),
    }
    source.self = source

    const out = sanitizeForTransport(source) as Record<string, unknown>
    expect(out.big).toBe('10')
    expect(out.fn).toBe('[function]')
    expect(out.date).toBe('2024-01-01T00:00:00.000Z')
    expect(out.self).toBe('[circular]')
  })
})
