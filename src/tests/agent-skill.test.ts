import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { mountAgentSkill } from '../agent-skill'

describe('agent-skill', () => {
  let testHome: string | undefined

  afterEach(async () => {
    if (testHome) {
      await rm(testHome, { recursive: true, force: true })
      testHome = undefined
    }
    delete process.env.AGENTS_HOME
  })

  test('mountAgentSkill writes embedded SKILL.md to target path', async () => {
    testHome = await mkdtemp(join(tmpdir(), 'interactor-skill-test-'))
    process.env.AGENTS_HOME = testHome

    const destination = await mountAgentSkill()
    const content = await readFile(destination, 'utf8')

    expect(destination).toBe(join(testHome, '.agents', 'skills', 'interactor', 'SKILL.md'))
    expect(content).toContain('name: interactor')
    expect(content).toContain('# Interactor CLI Skill')
  })
})
