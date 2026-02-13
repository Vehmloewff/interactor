import { z } from 'zod'

export const INTERACTOR_NAME_REGEX = /^[a-z0-9][a-z0-9-_]{0,63}$/i

export const interactorRequestModel = z.union([
	z.object({
		id: z.string().min(1),
		kind: z.literal('info'),
	}),
	z.object({
		id: z.string().min(1),
		kind: z.literal('events'),
	}),
	z.object({
		id: z.string().min(1),
		kind: z.literal('execute'),
		events: z.array(
			z.object({
				eventName: z.string().min(1),
				inputJson: z.string().default('{}'),
			})
		).min(1),
	}),
])

export type InteractorRequest = z.infer<typeof interactorRequestModel>
export type InteractorExecuteRequest = Extract<InteractorRequest, { kind: 'execute' }>

export const interactorResponseModel = z.union([
	z.object({
		id: z.string().min(1),
		ok: z.literal('true'),
		dataJson: z.string().default('null'),
	}),
	z.object({
		id: z.string().min(1),
		ok: z.literal('false'),
		error: z.string().min(1),
	}),
])

export type InteractorResponse = z.infer<typeof interactorResponseModel>

export const interactorInfoModel = z.object({
	name: z.string().regex(INTERACTOR_NAME_REGEX),
	url: z.string().min(1),
	pid: z.number().min(1),
	startedAt: z.number().min(0),
	socketPath: z.string().min(1),
})

export type InteractorInfo = z.infer<typeof interactorInfoModel>
