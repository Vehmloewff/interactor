import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { Err } from './utils'

import {
	interactorInfoModel,
	interactorRequestModel,
	interactorResponseModel,
	type InteractorInfo,
	type InteractorRequest,
	type InteractorResponse,
} from './schema'

const LOCAL_INTERACTOR_DIR = join(process.cwd(), '.interactor')
const GLOBAL_INTERACTOR_DIR = join(tmpdir(), 'interactors')
const SOCKET_EXT = '.sock'
const META_EXT = '.meta.json'

export type InteractorSocketScope = 'auto' | 'local' | 'global'

function sanitizeName(name: string): string {
	return name.toLowerCase().replaceAll(/[^a-z0-9-_]/g, '-')
}

function getSocketBaseName(name: string, pid: number): string {
	return `${sanitizeName(name)}-${pid}`
}

function getInteractorSocketDir(scope: Exclude<InteractorSocketScope, 'auto'>): string {
	if (scope === 'local') return LOCAL_INTERACTOR_DIR
	return GLOBAL_INTERACTOR_DIR
}

function getSocketPathFor(name: string, pid: number, scope: Exclude<InteractorSocketScope, 'auto'>): string {
	return join(getInteractorSocketDir(scope), `${getSocketBaseName(name, pid)}${SOCKET_EXT}`)
}

function getMetaPathFor(name: string, pid: number, scope: Exclude<InteractorSocketScope, 'auto'>): string {
	return join(getInteractorSocketDir(scope), `${getSocketBaseName(name, pid)}${META_EXT}`)
}

function resolveLookupScopes(scope: InteractorSocketScope): Exclude<InteractorSocketScope, 'auto'>[] {
	if (scope === 'local') return ['local']
	if (scope === 'global') return ['global']
	return ['local', 'global']
}

function decodeJson(data: string): unknown {
	try {
		return JSON.parse(data) as unknown
	} catch (error) {
		throw new Err('Invalid JSON payload').extend({ error }).expose()
	}
}

function encodeJson(data: unknown): string {
	return `${JSON.stringify(data)}\n`
}

function asErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message
	return 'unknown error'
}

function canSignalProcess(pid: number): boolean {
	try {
		process.kill(pid, 0)
		return true
	} catch {
		return false
	}
}

export function getInteractorSocketPath(name: string, pid: number, scope: Exclude<InteractorSocketScope, 'auto'>): string {
	return getSocketPathFor(name, pid, scope)
}

export async function ensureInteractorSocketDir(scope: Exclude<InteractorSocketScope, 'auto'>) {
	await mkdir(getInteractorSocketDir(scope), { recursive: true })
}

export async function cleanupSocketPath(path: string) {
	try {
		await unlink(path)
	} catch (error) {
		const code = (error as { code?: string }).code
		if (code === 'ENOENT') return

		throw error
	}
}

export async function writeInteractorMetadata(info: InteractorInfo, scope: Exclude<InteractorSocketScope, 'auto'>) {
	const metaPath = getMetaPathFor(info.name, info.pid, scope)
	await writeFile(metaPath, JSON.stringify(info, null, '\t'), 'utf8')
}

export async function removeInteractorMetadata(info: InteractorInfo, scope: Exclude<InteractorSocketScope, 'auto'>) {
	const metaPath = getMetaPathFor(info.name, info.pid, scope)
	await cleanupSocketPath(metaPath)
}

async function listKnownInteractorsInScope(scope: Exclude<InteractorSocketScope, 'auto'>) {
	await ensureInteractorSocketDir(scope)
	const interactorDir = getInteractorSocketDir(scope)
	const files = await readdir(interactorDir)
	const metas = files.filter(value => value.endsWith(META_EXT))
	const interactors: InteractorInfo[] = []

	for (const metaName of metas) {
		const fullPath = join(interactorDir, metaName)
		try {
			const raw = await readFile(fullPath, 'utf8')
			const parsed = await interactorInfoModel.parseAsync(decodeJson(raw))
			interactors.push(parsed)
		} catch {
			continue
		}
	}

	return interactors
}

export async function listKnownInteractors(scope: InteractorSocketScope = 'auto') {
	const scopes = resolveLookupScopes(scope)
	const known = await Promise.all(
		scopes.map(selectedScope =>
			listKnownInteractorsInScope(selectedScope).catch(() => {
				console.warn("couldn't read interactors from scope", selectedScope)
				return []
			})
		)
	)
	return known.flat()
}

export async function listLiveInteractors(scope: InteractorSocketScope = 'auto') {
	const known = await listKnownInteractors(scope)
	const live: InteractorInfo[] = []

	for (const info of known) {
		if (!canSignalProcess(info.pid)) continue

		try {
			const ping = await requestInteractor(info.socketPath, { id: crypto.randomUUID(), kind: 'info' })
			if (ping.ok !== 'true') continue
			live.push(info)
		} catch {
			continue
		}
	}

	return live
}

export async function findInteractorByName(name: string, scope: InteractorSocketScope = 'auto') {
	const live = await listLiveInteractors(scope)
	return live.find(value => value.name === name)
}

export async function resolveInteractorByNameOrSingle(
	name: string | undefined,
	scope: InteractorSocketScope = 'auto'
): Promise<InteractorInfo> {
	const live = await listLiveInteractors(scope)

	if (name !== undefined) {
		const selected = live.find(value => value.name === name)
		if (selected !== undefined) return selected
		throw new Err(`No running interactor found for name "${name}"`).expose()
	}

	if (live.length === 1) return live[0]!
	if (live.length === 0) throw new Err('No running interactors were found').expose()
	throw new Err('Multiple interactors are running. Pass --name to select one.').expose()
}

export async function createInteractorSocketServer(path: string, onRequest: (request: InteractorRequest) => Promise<unknown>) {
	await mkdir(dirname(path), { recursive: true })
	await cleanupSocketPath(path)

	const server = net.createServer(socket => {
		let buffer = ''

		socket.on('data', chunk => {
			buffer += chunk.toString()
			if (!buffer.includes('\n')) return

			void (async () => {
				const line = buffer.slice(0, buffer.indexOf('\n'))
				buffer = ''

				try {
					const parsed = await interactorRequestModel.parseAsync(decodeJson(line))
					const data = await onRequest(parsed)

					const response: InteractorResponse = {
						id: parsed.id,
						ok: 'true',
						dataJson: JSON.stringify(data ?? null),
					}
					socket.end(encodeJson(response))
				} catch (error) {
					const response: InteractorResponse = {
						id: crypto.randomUUID(),
						ok: 'false',
						error: asErrorMessage(error),
					}
					socket.end(encodeJson(response))
				}
			})()
		})
	})

	await new Promise<void>((resolve, reject) => {
		server.once('error', reject)
		server.listen(path, () => {
			server.off('error', reject)
			resolve()
		})
	})

	return server
}

export async function requestInteractor(path: string, request: InteractorRequest): Promise<InteractorResponse> {
	return await new Promise((resolve, reject) => {
		const client = net.createConnection(path)
		let buffer = ''

		client.on('error', reject)

		client.on('connect', () => {
			client.write(encodeJson(request))
		})

		client.on('data', chunk => {
			buffer += chunk.toString()
			if (!buffer.includes('\n')) return

			const line = buffer.slice(0, buffer.indexOf('\n'))
			buffer = ''

			void (async () => {
				try {
					const parsed = await interactorResponseModel.parseAsync(decodeJson(line))
					resolve(parsed)
				} catch (error) {
					reject(error)
				} finally {
					client.end()
				}
			})()
		})
	})
}
