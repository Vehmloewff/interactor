import { z } from 'zod'
import { Err } from '../utils'

import type { InteractorEventDefinition } from './define-event'
import type { EventRunCx } from './define-event'
import { browserEvents } from './browser'
import { contextEvents } from './context'
import { locatorEvents } from './locator'
import { pageEvents } from './page'

export const interactorEvents = [...pageEvents, ...contextEvents, ...browserEvents, ...locatorEvents]

const interactorEventMap = new Map<string, InteractorEventDefinition<string, any>>(interactorEvents.map(event => [event.name, event]))

export type EventDefinition = {
	name: string
	description: string
	keywords: string[]
}

export const INTERACTOR_EVENT_DEFINITIONS: EventDefinition[] = interactorEvents.map(event => ({
	name: event.name,
	description: event.description,
	keywords: event.keywords,
}))

export function getInteractorEvent(name: string) {
	return interactorEventMap.get(name)
}

export function getInteractorEventSchema(name: string): Record<string, unknown> | null {
	const event = getInteractorEvent(name)
	if (event === undefined) return null
	return z.toJSONSchema(event.inputModel) as Record<string, unknown>
}

export async function validateInteractorEventInputByName(name: string, input: unknown): Promise<unknown> {
	const event = getInteractorEvent(name)
	if (event === undefined) {
		throw new Err(`Unknown interactor event "${name}"`).expose()
	}

	return await event.inputModel.parseAsync(input)
}

export async function executeInteractorEvent(cx: EventRunCx, eventName: string, input: unknown): Promise<unknown> {
	const event = getInteractorEvent(eventName)
	if (event === undefined) {
		throw new Err(`Unknown interactor event "${eventName}"`).expose()
	}

	const validatedInput = await event.inputModel.parseAsync(input)
	return await event.run(cx, validatedInput)
}

export function findInteractorEvents(keywords: string[]) {
	const normalized = keywords.map(value => value.toLowerCase().trim()).filter(value => value.length > 0)

	if (normalized.length === 0) return INTERACTOR_EVENT_DEFINITIONS

	return INTERACTOR_EVENT_DEFINITIONS.filter(event => {
		const haystack = [event.name, event.description, ...event.keywords].join(' ').toLowerCase()
		return normalized.some(keyword => haystack.includes(keyword))
	})
}
