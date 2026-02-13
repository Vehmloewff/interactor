import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import skillMarkdown from '../SKILL.md' with { type: 'txt' }

export async function mountAgentSkill(): Promise<string> {
	const baseHome = process.env.AGENTS_HOME ?? homedir()
	const targetDir = join(baseHome, '.agents', 'skills', 'interactor')
	const targetPath = join(targetDir, 'SKILL.md')

	await mkdir(targetDir, { recursive: true })
	await writeFile(targetPath, skillMarkdown, 'utf8')

	return targetPath
}
