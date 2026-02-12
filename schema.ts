import { M, type Infer } from '~/data-modeler'

export const INTERACTOR_NAME_REGEX = /^[a-z0-9][a-z0-9-_]{0,63}$/i

export const interactorRequestModel = M.union([
	M.object({
		id: M.string().min(1),
		kind: M.lit('info'),
	}),
	M.object({
		id: M.string().min(1),
		kind: M.lit('events'),
	}),
	M.object({
		id: M.string().min(1),
		kind: M.lit('execute'),
		events: M.array(
			M.object({
				eventName: M.string().min(1),
				inputJson: M.string().default('{}'),
			})
		).min(1),
	}),
])

export type InteractorRequest = Infer<typeof interactorRequestModel>
export type InteractorExecuteRequest = Extract<InteractorRequest, { kind: 'execute' }>

export const interactorResponseModel = M.union([
	M.object({
		id: M.string().min(1),
		ok: M.lit('true'),
		dataJson: M.string().default('null'),
	}),
	M.object({
		id: M.string().min(1),
		ok: M.lit('false'),
		error: M.string().min(1),
	}),
])

export type InteractorResponse = Infer<typeof interactorResponseModel>

export const interactorInfoModel = M.object({
	name: M.string().matches(INTERACTOR_NAME_REGEX),
	url: M.string().min(1),
	pid: M.number().min(1),
	startedAt: M.number().min(0),
	socketPath: M.string().min(1),
})

export type InteractorInfo = Infer<typeof interactorInfoModel>
