import { describe, expect, test } from 'bun:test'

import { cleanupSocketPath, getInteractorSocketPath } from '../socket'

describe('socket', () => {
  test('getInteractorSocketPath builds scoped socket path', () => {
    const localPath = getInteractorSocketPath('default', 123, 'local')
    const globalPath = getInteractorSocketPath('default', 123, 'global')

    expect(localPath.endsWith('.sock')).toBeTrue()
    expect(globalPath.endsWith('.sock')).toBeTrue()
    expect(localPath).toContain('.interactor')
    expect(globalPath).toContain('interactors')
  })

  test('cleanupSocketPath ignores missing files', async () => {
    await expect(cleanupSocketPath('/tmp/path-that-does-not-exist.sock')).resolves.toBeUndefined()
  })
})
