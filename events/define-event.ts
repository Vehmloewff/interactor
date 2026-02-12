import type { Infer, M } from '~/data-modeler'
import type { Browser, BrowserContext, Page } from 'playwright'

export type InteractorConsoleEntry = {
	type: string
	text: string
	location: {
		url?: string
		lineNumber?: number
		columnNumber?: number
	}
	timestamp: number
}

export type InteractorPageErrorEntry = {
	message: string
	stack?: string
	timestamp: number
}

export type InteractorRuntime = {
	consoleEntries: InteractorConsoleEntry[]
	pageErrors: InteractorPageErrorEntry[]
}

export type EventRunCx = {
	page: Page
	context: BrowserContext
	browser: Browser
	runtime: InteractorRuntime
}

export type InteractorEventDefinition<Name extends string = string, Input = any> = {
	name: Name
	description: string
	keywords: string[]
	inputModel: M<Input>
	run: (cx: EventRunCx, input: Input) => Promise<unknown>
}

export function defineEvent<Name extends string, Input>(
	name: Name,
	description: string,
	inputModel: M<Input>,
	run: (cx: EventRunCx, input: Infer<M<Input>>) => Promise<unknown>,
	keywords: string[] = []
): InteractorEventDefinition<Name, Input> {
	return {
		name,
		description,
		keywords,
		inputModel,
		run,
	}
}
