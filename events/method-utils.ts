import { M } from '~/data-modeler'
import { Err } from '~/utils'

export const timeoutMsOptionalModel = M.number().min(0).optional().comment('Optional timeout in milliseconds')

export function parseJsonObject(value: string | undefined, field: string): Record<string, unknown> | undefined {
	if (value === undefined) return undefined
	try {
		const parsed = JSON.parse(value) as unknown
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
			throw new Err(`${field} must be a JSON object`).expose()
		}
		return parsed as Record<string, unknown>
	} catch (error) {
		throw new Err(`Invalid JSON in ${field}`).extend({ error }).expose()
	}
}

export function parseJsonArray(value: string | undefined, field: string): unknown[] | undefined {
	if (value === undefined) return undefined
	try {
		const parsed = JSON.parse(value) as unknown
		if (!Array.isArray(parsed)) throw new Err(`${field} must be a JSON array`).expose()
		return parsed
	} catch (error) {
		throw new Err(`Invalid JSON in ${field}`).extend({ error }).expose()
	}
}

export function sanitizeForTransport(value: unknown, seen = new WeakSet<object>()): unknown {
	if (value === null || value === undefined) return value
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
	if (typeof value === 'bigint') return value.toString()
	if (typeof value === 'symbol') return String(value)
	if (typeof value === 'function') return '[function]'

	if (Array.isArray(value)) {
		return value.map(item => sanitizeForTransport(item, seen))
	}

	if (typeof value === 'object') {
		if (seen.has(value)) return '[circular]'
		seen.add(value)

		if (value instanceof Date) return value.toISOString()

		const prototype = Object.getPrototypeOf(value)
		if (prototype === Object.prototype || prototype === null) {
			const obj = value as Record<string, unknown>
			return Object.fromEntries(Object.entries(obj).map(([key, val]) => [key, sanitizeForTransport(val, seen)]))
		}

		const type = (value as { constructor?: { name?: string } }).constructor?.name ?? 'Object'
		const text = String(value)
		if (text !== '[object Object]') return text
		return { type }
	}

	return String(value)
}
