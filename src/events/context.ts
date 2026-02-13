import { z } from 'zod'

import { defineEvent } from './define-event'
import { parseJsonArray, parseJsonObject, sanitizeForTransport, timeoutMsOptionalModel } from './method-utils'

/*
Implemented all Playwright BrowserContext methods except methods that require callback registration
or other highly dynamic runtime values:
  'exposeBinding'
  'exposeFunction'
  'removeAllListeners'
  'on'
  'once'
  'addListener'
  'removeListener'
  'off'
  'prependListener'
  'route'
  'routeFromHAR'
  'routeWebSocket'
  'unroute'
  'unrouteAll'
  'waitForEvent'
  'browser'
  'newCDPSession'
  'serviceWorkers'
  'backgroundPages'
*/

export const contextEvents = [
	defineEvent(
		'context.addCookies',
		'Add cookies to the browser context',
		z.object({
			cookiesJson: z.string().describe('JSON array of Playwright cookie objects'),
		}),
		async ({ context }, input) => {
			const cookies = parseJsonArray(input.cookiesJson, 'cookiesJson') ?? []
			await context.addCookies(cookies as any)
			return { added: cookies.length }
		},
		['cookies', 'context']
	),
	defineEvent(
		'context.clearCookies',
		'Clear cookies for the browser context',
		z.object({}),
		async ({ context }) => {
			await context.clearCookies()
			return { cleared: true }
		},
		['cookies', 'clear']
	),
	defineEvent(
		'context.clearPermissions',
		'Clear all granted permissions in the browser context',
		z.object({}),
		async ({ context }) => {
			await context.clearPermissions()
			return { cleared: true }
		},
		['permissions']
	),
	defineEvent(
		'context.close',
		'Close the browser context',
		z.object({}),
		async ({ context }) => {
			await context.close()
			return { closed: true }
		},
		['context', 'close']
	),
	defineEvent(
		'context.cookies',
		'Read cookies from the browser context',
		z.object({
			urlsJson: z.string().optional().describe('Optional JSON array of URL strings to filter cookies'),
		}),
		async ({ context }, input) => {
			const urls = parseJsonArray(input.urlsJson, 'urlsJson') as string[] | undefined
			return await context.cookies(urls)
		},
		['cookies']
	),
	defineEvent(
		'context.grantPermissions',
		'Grant browser permissions for the context',
		z.object({
			permissionsJson: z.string().describe('JSON array of permission strings'),
			origin: z.string().optional().describe('Optional origin URL'),
		}),
		async ({ context }, input) => {
			const permissions = parseJsonArray(input.permissionsJson, 'permissionsJson') as string[]
			await context.grantPermissions(permissions, { origin: input.origin })
			return { granted: permissions.length }
		},
		['permissions']
	),
	defineEvent(
		'context.newPage',
		'Create a new page in this browser context',
		z.object({}),
		async ({ context }) => {
			const page = await context.newPage()
			return { url: page.url() }
		},
		['page', 'create']
	),
	defineEvent(
		'context.pages',
		'List current pages in this browser context',
		z.object({}),
		async ({ context }) => context.pages().map(page => ({ url: page.url(), isClosed: page.isClosed() })),
		['pages']
	),
	defineEvent(
		'context.setDefaultNavigationTimeout',
		'Set default navigation timeout for this context',
		z.object({
			timeoutMs: z.number().min(0).describe('Timeout in milliseconds'),
		}),
		async ({ context }, input) => {
			context.setDefaultNavigationTimeout(input.timeoutMs)
			return { timeoutMs: input.timeoutMs }
		},
		['timeout']
	),
	defineEvent(
		'context.setDefaultTimeout',
		'Set default timeout for this context',
		z.object({
			timeoutMs: z.number().min(0).describe('Timeout in milliseconds'),
		}),
		async ({ context }, input) => {
			context.setDefaultTimeout(input.timeoutMs)
			return { timeoutMs: input.timeoutMs }
		},
		['timeout']
	),
	defineEvent(
		'context.setExtraHTTPHeaders',
		'Set extra HTTP headers for all context requests',
		z.object({
			headersJson: z.string().describe('JSON object map of header names to values'),
		}),
		async ({ context }, input) => {
			const headers = parseJsonObject(input.headersJson, 'headersJson') ?? {}
			await context.setExtraHTTPHeaders(headers as Record<string, string>)
			return { set: true, count: Object.keys(headers).length }
		},
		['headers', 'http']
	),
	defineEvent(
		'context.setGeolocation',
		'Set geolocation for context pages',
		z.object({
			latitude: z.number().describe('Latitude'),
			longitude: z.number().describe('Longitude'),
			accuracy: z.number().min(0).optional().describe('Optional accuracy in meters'),
		}),
		async ({ context }, input) => {
			await context.setGeolocation({
				latitude: input.latitude,
				longitude: input.longitude,
				accuracy: input.accuracy,
			})
			return { set: true }
		},
		['geolocation']
	),
	defineEvent(
		'context.setHTTPCredentials',
		'Set HTTP authentication credentials for context requests',
		z.object({
			username: z.string().describe('HTTP auth username'),
			password: z.string().describe('HTTP auth password'),
		}),
		async ({ context }, input) => {
			await context.setHTTPCredentials({ username: input.username, password: input.password })
			return { set: true }
		},
		['http', 'auth']
	),
	defineEvent(
		'context.setOffline',
		'Enable or disable offline network mode',
		z.object({
			offline: z.boolean().describe('When true, context operates in offline mode'),
		}),
		async ({ context }, input) => {
			await context.setOffline(input.offline)
			return { offline: input.offline }
		},
		['network', 'offline']
	),
	defineEvent(
		'context.storageState',
		'Read or write storage state snapshot',
		z.object({
			path: z.string().optional().describe('Optional path to write storage state JSON'),
		}),
		async ({ context }, input) => sanitizeForTransport(await context.storageState({ path: input.path })),
		['storage', 'state']
	),
] as const
