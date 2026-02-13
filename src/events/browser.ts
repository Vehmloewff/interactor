import { z } from 'zod'

import { defineEvent } from './define-event'
import { sanitizeForTransport } from './method-utils'

/*
Implemented all Playwright Browser methods except methods that require callback registration
or other highly dynamic runtime values:
  'removeAllListeners'
  'on'
  'once'
  'addListener'
  'removeListener'
  'off'
  'prependListener'
  'newBrowserCDPSession'
  'startTracing'
  'stopTracing'
*/

export const browserEvents = [
	defineEvent(
		'browser.browserType',
		'Get browser type details',
		z.object({}),
		async ({ browser }) => sanitizeForTransport(browser.browserType()),
		['browser', 'type']
	),
	defineEvent(
		'browser.close',
		'Close the browser',
		z.object({}),
		async ({ browser }) => {
			await browser.close()
			return { closed: true }
		},
		['browser', 'close']
	),
	defineEvent(
		'browser.contexts',
		'List browser contexts',
		z.object({}),
		async ({ browser }) => browser.contexts().map((_, index) => ({ index })),
		['contexts']
	),
	defineEvent(
		'browser.isConnected',
		'Check whether browser connection is active',
		z.object({}),
		async ({ browser }) => browser.isConnected(),
		['browser', 'status']
	),
	defineEvent(
		'browser.newContext',
		'Create a new browser context',
		z.object({}),
		async ({ browser }) => {
			await browser.newContext()
			return { created: true }
		},
		['context', 'create']
	),
	defineEvent(
		'browser.newPage',
		'Create a new browser page',
		z.object({}),
		async ({ browser }) => {
			const page = await browser.newPage()
			return { url: page.url() }
		},
		['page', 'create']
	),
	defineEvent(
		'browser.version',
		'Get browser version string',
		z.object({}),
		async ({ browser }) => browser.version(),
		['browser', 'version']
	),
] as const
