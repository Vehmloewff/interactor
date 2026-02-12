import { Command } from 'commander'

import { findInteractorEvents, getInteractorEventSchema, validateInteractorEventInputByName } from './events'
import { INTERACTOR_NAME_REGEX } from './schema'
import { startInteractorServer } from './server'
import { type InteractorSocketScope, listLiveInteractors, requestInteractor, resolveInteractorByNameOrSingle } from './socket'

type CommandOptionsWithName = {
	name?: string
	global?: boolean
}

type StartOptions = {
	name?: string
	headed?: boolean
	global?: boolean
}

type ExecutePair = {
	eventName: string
	inputJson: string
}

type ExecuteOutcome = { status: 'ok'; value: unknown } | { status: 'error'; message: string }

function parseJson(value: string): unknown {
	try {
		return JSON.parse(value) as unknown
	} catch (error) {
		throw new Error(`Invalid JSON: ${(error as Error).message}`)
	}
}

function parseExecutePairs(args: string[]): ExecutePair[] {
	if (args.length === 0) {
		throw new Error('execute requires at least one <event> <json> pair')
	}

	if (args.length % 2 !== 0) {
		throw new Error('execute arguments must be ordered as repeated <event> <json> pairs')
	}

	const pairs: ExecutePair[] = []
	for (let i = 0; i < args.length; i += 2) {
		pairs.push({
			eventName: args[i]!,
			inputJson: args[i + 1]!,
		})
	}

	return pairs
}

async function normalizeExecutePair(pair: ExecutePair) {
	const rawInput = parseJson(pair.inputJson)
	const validatedInput = await validateInteractorEventInputByName(pair.eventName, rawInput)

	return {
		eventName: pair.eventName,
		inputJson: JSON.stringify(validatedInput),
	}
}

function getErrorMessage(error: unknown) {
	if (error instanceof Error) return error.message
	return String(error)
}

async function executePair(socketPath: string, pair: ExecutePair): Promise<ExecuteOutcome> {
	let event: { eventName: string; inputJson: string }
	try {
		event = await normalizeExecutePair(pair)
	} catch (error) {
		return {
			status: 'error',
			message: getErrorMessage(error),
		}
	}

	const response = await requestInteractor(socketPath, {
		id: crypto.randomUUID(),
		kind: 'execute',
		events: [event],
	})

	if (response.ok === 'false') {
		return {
			status: 'error',
			message: response.error,
		}
	}

	const results = parseJson(response.dataJson)
	if (!Array.isArray(results)) {
		return {
			status: 'error',
			message: 'Interactor execute response was not an array',
		}
	}

	if (results.length !== 1) {
		return {
			status: 'error',
			message: `Interactor execute response expected exactly one result, received ${results.length}`,
		}
	}

	return {
		status: 'ok',
		value: results[0],
	}
}

function assertNameOrThrow(name: string) {
	if (INTERACTOR_NAME_REGEX.test(name)) return
	throw new Error(`Invalid name "${name}". Expected ${INTERACTOR_NAME_REGEX.toString()}`)
}

function resolveSocketScope(forceGlobal: boolean | undefined): InteractorSocketScope {
	if (forceGlobal) return 'global'
	return 'auto'
}

async function run() {
	const command = new Command()

	command.name('interactor').description('Control browser-based interactors over unix sockets')

	command
		.command('start')
		.description('Start a named interactor and connect to a URL')
		.argument('<url>', 'URL to open with Playwright')
		.option('-n, --name <name>', 'Unique interactor name', 'default')
		.option('--headed', 'Run Playwright in headed mode', false)
		.option('--global', 'Use shared tmpdir interactor sockets', false)
		.action(async (url: string, options: StartOptions) => {
			const name = options.name ?? 'default'
			assertNameOrThrow(name)

			await startInteractorServer({
				name,
				url,
				headless: !Boolean(options.headed),
				socketScope: options.global ? 'global' : 'local',
			})
		})

	command
		.command('ps')
		.description('List running interactors')
		.option('--global', 'Use shared tmpdir interactor sockets only', false)
		.action(async (options: CommandOptionsWithName) => {
			const interactors = await listLiveInteractors(resolveSocketScope(options.global))
			if (interactors.length === 0) {
				console.log('No running interactors found.')
				return
			}

			for (const info of interactors) {
				console.log(`${info.name}\tpid=${info.pid}\turl=${info.url}\tsocket=${info.socketPath}`)
			}
		})

	command
		.command('execute')
		.description('Execute one or more interactor events in sequence')
		.argument('<eventAndInputs...>', 'Repeated pairs of <event> <json>')
		.option('-n, --name <name>', 'Interactor name')
		.option('--global', 'Use shared tmpdir interactor sockets only', false)
		.action(async (eventAndInputs: string[], options: CommandOptionsWithName) => {
			const selected = await resolveInteractorByNameOrSingle(options.name, resolveSocketScope(options.global))
			const pairs = parseExecutePairs(eventAndInputs)

			let failures = 0

			for (const pair of pairs) {
				const outcome = await executePair(selected.socketPath, pair)

				if (outcome.status === 'ok') {
					console.log(`ok ${JSON.stringify(outcome.value)}`)
					continue
				}

				failures += 1
				console.log(`error ${outcome.message}`)
			}

			process.exitCode = failures
		})

	command
		.command('find')
		.description('Search available interactor events')
		.argument('[keywords...]', 'Keywords for event search')
		.action((keywords: string[] | undefined) => {
			const matches = findInteractorEvents(keywords ?? [])

			if (matches.length === 0) {
				console.log('No matching events found.')
				return
			}

			for (const match of matches) {
				const schema = getInteractorEventSchema(match.name)
				console.log(`${match.name}\t${match.description}\t${JSON.stringify(schema)}`)
			}
		})

	await command.parseAsync(process.argv)
}

run().catch(error => {
	console.error(error)
	process.exit(1)
})
