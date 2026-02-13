import type { Browser, BrowserContext, Page } from 'playwright'
import { chromium } from 'playwright'

import { installPlaywrightBrowsers } from './playwright-install'
import { Err } from './utils'

import { executeInteractorEvent, INTERACTOR_EVENT_DEFINITIONS } from './events'
import type { InteractorRuntime } from './events/define-event'
import { type InteractorExecuteRequest, type InteractorInfo, INTERACTOR_NAME_REGEX } from './schema'
import {
	type InteractorSocketScope,
	createInteractorSocketServer,
	findInteractorByName,
	getInteractorSocketPath,
	removeInteractorMetadata,
	writeInteractorMetadata,
	cleanupSocketPath,
} from './socket'

export type StartInteractorOptions = {
	name: string
	url: string
	headless: boolean
	socketScope: Exclude<InteractorSocketScope, 'auto'>
}

function assertInteractorName(name: string) {
	if (INTERACTOR_NAME_REGEX.test(name)) return

	throw new Err(`Invalid interactor name "${name}". Expected ${INTERACTOR_NAME_REGEX.toString()} and max length 64.`).expose()
}

function handleInfoRequest(info: InteractorInfo) {
	return {
		...info,
		events: INTERACTOR_EVENT_DEFINITIONS,
	}
}

function trimRuntimeBuffer(runtime: InteractorRuntime, maxEntries = 1000) {
	if (runtime.consoleEntries.length > maxEntries) {
		runtime.consoleEntries = runtime.consoleEntries.slice(runtime.consoleEntries.length - maxEntries)
	}

	if (runtime.pageErrors.length > maxEntries) {
		runtime.pageErrors = runtime.pageErrors.slice(runtime.pageErrors.length - maxEntries)
	}
}

async function handleExecuteRequest(
	page: Page,
	context: BrowserContext,
	browser: Browser,
	runtime: InteractorRuntime,
	request: InteractorExecuteRequest
) {
	const results: unknown[] = []

	for (const event of request.events) {
		let input: unknown = {}
		try {
			input = JSON.parse(event.inputJson) as unknown
		} catch (error) {
			throw new Err(`Invalid JSON input for execute event "${event.eventName}"`).extend({ error }).expose()
		}

		const result = await executeInteractorEvent({ page, context, browser, runtime }, event.eventName, input)
		results.push(result)
	}

	return results
}

async function openBrowserPage(options: StartInteractorOptions): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
	let browser: Browser
	try {
		browser = await chromium.launch({ headless: options.headless })
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		const missingBrowser =
			message.includes('Executable doesn\'t exist') ||
			message.includes('Please run the following command to download new browsers')

		if (!missingBrowser) throw error

		console.warn('Chromium runtime not found, installing automatically...')
		await installPlaywrightBrowsers({ browsers: ['chromium'] })
		browser = await chromium.launch({ headless: options.headless })
	}
	const context = await browser.newContext()
	const page = await context.newPage()

	await page.goto(options.url, { waitUntil: 'load' })

	return { browser, context, page }
}

export async function startInteractorServer(options: StartInteractorOptions): Promise<void> {
	assertInteractorName(options.name)

	const existing = await findInteractorByName(options.name, options.socketScope)
	if (existing !== undefined) {
		throw new Err(`Interactor "${options.name}" is already running (pid ${existing.pid}).`).expose()
	}

	const socketPath = getInteractorSocketPath(options.name, process.pid, options.socketScope)
	const info: InteractorInfo = {
		name: options.name,
		url: options.url,
		pid: process.pid,
		startedAt: Date.now(),
		socketPath,
	}

	const { browser, context, page } = await openBrowserPage(options)
	let runtime: InteractorRuntime = { consoleEntries: [], pageErrors: [] }

	page.on('console', msg => {
		runtime.consoleEntries.push({
			type: msg.type(),
			text: msg.text(),
			location: msg.location(),
			timestamp: Date.now(),
		})
		trimRuntimeBuffer(runtime)
	})

	page.on('pageerror', error => {
		runtime.pageErrors.push({
			message: error.message,
			stack: error.stack,
			timestamp: Date.now(),
		})
		trimRuntimeBuffer(runtime)
	})

	let pendingOperationPromise = Promise.resolve()

	const server = await createInteractorSocketServer(socketPath, async request => {
		if (request.kind === 'info') return handleInfoRequest(info)
		if (request.kind === 'events') return INTERACTOR_EVENT_DEFINITIONS
		if (request.kind !== 'execute') throw new Err('Unsupported request kind').expose()

		await pendingOperationPromise

		const promise = handleExecuteRequest(page, context, browser, runtime, request)
		pendingOperationPromise = promise.then(() => {}).catch(() => {})

		return await promise
	})

	await writeInteractorMetadata(info, options.socketScope)

	const close = async () => {
		server.close()
		await browser.close()
		await removeInteractorMetadata(info, options.socketScope)
		await cleanupSocketPath(socketPath)
	}

	process.on('SIGINT', () => {
		void close().finally(() => process.exit(0))
	})
	process.on('SIGTERM', () => {
		void close().finally(() => process.exit(0))
	})

	console.log(`interactor "${options.name}" started`)
	console.log(`pid=${process.pid}`)
	console.log(`socket=${socketPath}`)
	console.log(`url=${options.url}`)

	await new Promise<void>(() => {})
}
