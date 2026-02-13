export class Err extends Error {
	details?: unknown

	constructor(message: string) {
		super(message)
		this.name = 'Err'
	}

	extend(details: unknown): this {
		this.details = details
		return this
	}

	expose(): this {
		return this
	}
}
