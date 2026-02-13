import { describe, expect, test } from 'bun:test'

import {
  INTERACTOR_NAME_REGEX,
  interactorInfoModel,
  interactorRequestModel,
  interactorResponseModel,
} from '../schema'

describe('schema', () => {
  test('accepts valid interactor names', () => {
    expect(INTERACTOR_NAME_REGEX.test('default')).toBeTrue()
    expect(INTERACTOR_NAME_REGEX.test('my-name_1')).toBeTrue()
  })

  test('rejects invalid interactor names', () => {
    expect(INTERACTOR_NAME_REGEX.test('-bad')).toBeFalse()
    expect(INTERACTOR_NAME_REGEX.test('bad space')).toBeFalse()
  })

  test('parses execute request and applies defaults', async () => {
    const parsed = await interactorRequestModel.parseAsync({
      id: 'abc',
      kind: 'execute',
      events: [{ eventName: 'page.title' }],
    })

    if (parsed.kind !== 'execute') throw new Error('expected execute request')
    expect(parsed.kind).toBe('execute')
    expect(parsed.events[0]?.inputJson).toBe('{}')
  })

  test('parses success response and applies defaults', async () => {
    const parsed = await interactorResponseModel.parseAsync({
      id: '1',
      ok: 'true',
    })

    if (parsed.ok !== 'true') throw new Error('expected success response')
    expect(parsed.ok).toBe('true')
    expect(parsed.dataJson).toBe('null')
  })

  test('validates interactor info shape', async () => {
    const parsed = await interactorInfoModel.parseAsync({
      name: 'default',
      url: 'https://example.com',
      pid: 123,
      startedAt: Date.now(),
      socketPath: '/tmp/interactor.sock',
    })

    expect(parsed.name).toBe('default')
  })
})
