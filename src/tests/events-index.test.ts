import { describe, expect, test } from 'bun:test'

import {
  findInteractorEvents,
  getInteractorEvent,
  getInteractorEventSchema,
  INTERACTOR_EVENT_DEFINITIONS,
  validateInteractorEventInputByName,
} from '../events'

describe('events/index', () => {
  test('has event definitions', () => {
    expect(INTERACTOR_EVENT_DEFINITIONS.length).toBeGreaterThan(0)
  })

  test('findInteractorEvents returns all when no keywords', () => {
    const matches = findInteractorEvents([])
    expect(matches.length).toBe(INTERACTOR_EVENT_DEFINITIONS.length)
  })

  test('findInteractorEvents filters by keyword', () => {
    const matches = findInteractorEvents(['navigate'])
    expect(matches.some(event => event.name === 'page.goto')).toBeTrue()
  })

  test('getInteractorEvent resolves known event and misses unknown', () => {
    expect(getInteractorEvent('page.goto')).toBeDefined()
    expect(getInteractorEvent('missing.event')).toBeUndefined()
  })

  test('getInteractorEventSchema returns JSON schema for known event', () => {
    const schema = getInteractorEventSchema('page.goto') as { type?: string }
    expect(schema).toBeTruthy()
    expect(schema.type).toBe('object')
  })

  test('validateInteractorEventInputByName rejects unknown event', async () => {
    await expect(validateInteractorEventInputByName('missing.event', {})).rejects.toThrow()
  })

  test('validateInteractorEventInputByName validates known event input', async () => {
    const out = await validateInteractorEventInputByName('page.goto', { url: 'https://example.com' })
    expect(out).toEqual({ url: 'https://example.com' })
  })
})
