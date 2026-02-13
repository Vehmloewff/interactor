import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { z } from 'zod'
import { Err } from '../utils'

import { defineEvent } from './define-event'

const waitUntilModel = z.union([z.literal('commit'), z.literal('domcontentloaded'), z.literal('load'), z.literal('networkidle')])
	.optional()
	.describe('Optional Playwright navigation lifecycle target')
const mouseButtonModel = z.union([z.literal('left'), z.literal('middle'), z.literal('right')])
	.optional()
	.describe('Optional mouse button to use for click interactions')
const selectorModel = z.string().min(1).describe('Target selector used to find an element')
const timeoutMsOptionalModel = z.number().min(0).optional().describe('Optional timeout in milliseconds')
const delayMsOptionalModel = z.number().min(0).optional().describe('Optional delay in milliseconds')
const clickCountOptionalModel = z.number().min(1).optional().describe('Optional number of clicks to perform')

function parseArgJson(argJson: string | undefined): unknown {
	if (argJson === undefined) return undefined

	try {
		return JSON.parse(argJson) as unknown
	} catch (error) {
		throw new Err('Invalid JSON in argJson').extend({ error })
	}
}


function parseJsonObject(value: string | undefined, field: string): Record<string, unknown> | undefined {
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

function sanitizeForTransport(value: unknown, seen = new WeakSet<object>()): unknown {
	if (value === null || value === undefined) return value
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
	if (typeof value === 'bigint') return value.toString()
	if (typeof value === 'symbol') return String(value)
	if (typeof value === 'function') return '[function]'

	if (Array.isArray(value)) return value.map(item => sanitizeForTransport(item, seen))

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

function getScreenshotPath(path: string | undefined): string {
	if (path !== undefined) return path
	return join(tmpdir(), `interactor-shot-${crypto.randomUUID()}.png`)
}

const corePageEvents = [
	defineEvent(
		'page.goto',
		'Navigate to a new URL',
		z.object({
			url: z.string().min(1).describe('Target URL to open in the page'),
			timeoutMs: z.number().min(0).optional().describe('Optional navigation timeout in milliseconds'),
			waitUntil: waitUntilModel.describe('Optional Playwright waitUntil lifecycle target'),
		}),
		async ({ page }, input) => {
			await page.goto(input.url, { timeout: input.timeoutMs, waitUntil: input.waitUntil })
			return { url: page.url() }
		},
		['navigate', 'url', 'visit', 'open']
	),
	defineEvent(
		'page.reload',
		'Reload the current page',
		z.object({
			timeoutMs: z.number().min(0).optional().describe('Optional reload timeout in milliseconds'),
			waitUntil: waitUntilModel.describe('Optional Playwright waitUntil lifecycle target'),
		}),
		async ({ page }, input) => {
			await page.reload({ timeout: input.timeoutMs, waitUntil: input.waitUntil })
			return { url: page.url() }
		},
		['refresh', 'reload']
	),
	defineEvent(
		'page.goBack',
		'Navigate back in history',
		z.object({
			timeoutMs: timeoutMsOptionalModel,
			waitUntil: waitUntilModel,
		}),
		async ({ page }, input) => {
			await page.goBack({ timeout: input.timeoutMs, waitUntil: input.waitUntil })
			return { url: page.url() }
		},
		['back', 'history']
	),
	defineEvent(
		'page.goForward',
		'Navigate forward in history',
		z.object({
			timeoutMs: timeoutMsOptionalModel,
			waitUntil: waitUntilModel,
		}),
		async ({ page }, input) => {
			await page.goForward({ timeout: input.timeoutMs, waitUntil: input.waitUntil })
			return { url: page.url() }
		},
		['forward', 'history']
	),
	defineEvent(
		'page.click',
		'Click a page element',
		z.object({
			selector: selectorModel,
			button: mouseButtonModel,
			clickCount: clickCountOptionalModel,
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.click(input.selector, { button: input.button, clickCount: input.clickCount, timeout: input.timeoutMs })
			return { clicked: true }
		},
		['click', 'selector', 'tap']
	),
	defineEvent(
		'page.dblclick',
		'Double-click a page element',
		z.object({
			selector: selectorModel,
			button: mouseButtonModel,
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.dblclick(input.selector, { button: input.button, timeout: input.timeoutMs })
			return { clicked: true }
		},
		['double', 'click', 'selector']
	),
	defineEvent(
		'page.fill',
		'Fill an input element',
		z.object({
			selector: selectorModel,
			value: z.string().describe('Text value to set in the target input element'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.fill(input.selector, input.value, { timeout: input.timeoutMs })
			return { filled: true }
		},
		['input', 'fill', 'form']
	),
	defineEvent(
		'page.type',
		'Type text into an element',
		z.object({
			selector: selectorModel,
			text: z.string().describe('Text to type into the element'),
			delayMs: delayMsOptionalModel,
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.type(input.selector, input.text, { delay: input.delayMs, timeout: input.timeoutMs })
			return { typed: true }
		},
		['type', 'keyboard', 'input']
	),
	defineEvent(
		'page.press',
		'Press a key on an element',
		z.object({
			selector: selectorModel,
			key: z.string().min(1).describe('Keyboard key name, for example Enter or ArrowDown'),
			delayMs: delayMsOptionalModel,
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.press(input.selector, input.key, { delay: input.delayMs, timeout: input.timeoutMs })
			return { pressed: true }
		},
		['press', 'keyboard', 'key']
	),
	defineEvent(
		'page.focus',
		'Focus an element',
		z.object({
			selector: selectorModel,
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.focus(input.selector, { timeout: input.timeoutMs })
			return { focused: true }
		},
		['focus', 'selector']
	),
	defineEvent(
		'page.hover',
		'Hover over an element',
		z.object({
			selector: selectorModel,
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.hover(input.selector, { timeout: input.timeoutMs })
			return { hovered: true }
		},
		['hover', 'selector', 'mouse']
	),
	defineEvent(
		'page.check',
		'Check a checkbox/radio input',
		z.object({
			selector: selectorModel,
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.check(input.selector, { timeout: input.timeoutMs })
			return { checked: true }
		},
		['check', 'checkbox', 'radio']
	),
	defineEvent(
		'page.uncheck',
		'Uncheck a checkbox input',
		z.object({
			selector: selectorModel,
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.uncheck(input.selector, { timeout: input.timeoutMs })
			return { checked: false }
		},
		['uncheck', 'checkbox']
	),
	defineEvent(
		'page.selectOption',
		'Select option values in a select element',
		z.object({
			selector: selectorModel,
			values: z.array(z.string().min(1)).min(1).describe('Option values to select'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			const selected = await page.selectOption(input.selector, input.values, { timeout: input.timeoutMs })
			return { selected }
		},
		['select', 'option', 'form']
	),
	defineEvent(
		'page.setInputFiles',
		'Attach files to an input[type=file]',
		z.object({
			selector: selectorModel,
			paths: z.array(z.string().min(1)).min(1).describe('Absolute or relative file paths to upload'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.setInputFiles(input.selector, input.paths, { timeout: input.timeoutMs })
			return { attached: input.paths.length }
		},
		['upload', 'file', 'input']
	),
	defineEvent(
		'page.mouse.click',
		'Click at page coordinates',
		z.object({
			x: z.number().describe('Horizontal click coordinate in CSS pixels'),
			y: z.number().describe('Vertical click coordinate in CSS pixels'),
			button: mouseButtonModel,
			clickCount: clickCountOptionalModel,
			delayMs: delayMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.mouse.click(input.x, input.y, {
				button: input.button,
				clickCount: input.clickCount,
				delay: input.delayMs,
			})
			return { clicked: true }
		},
		['mouse', 'coordinates', 'click']
	),
	defineEvent(
		'page.keyboard.type',
		'Type via page keyboard',
		z.object({
			text: z.string().describe('Text to type with page.keyboard'),
			delayMs: delayMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.keyboard.type(input.text, { delay: input.delayMs })
			return { typed: true }
		},
		['keyboard', 'type']
	),
	defineEvent(
		'page.keyboard.press',
		'Press a key via page keyboard',
		z.object({
			key: z.string().min(1).describe('Keyboard key name, for example Enter'),
			delayMs: delayMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.keyboard.press(input.key, { delay: input.delayMs })
			return { pressed: true }
		},
		['keyboard', 'press']
	),
	defineEvent(
		'page.waitForSelector',
		'Wait for selector state',
		z.object({
			selector: selectorModel,
			timeoutMs: timeoutMsOptionalModel,
			state: z.union([z.literal('attached'), z.literal('detached'), z.literal('hidden'), z.literal('visible')]).optional().describe('Desired selector state before resolving'),
		}),
		async ({ page }, input) => {
			await page.waitForSelector(input.selector, { timeout: input.timeoutMs, state: input.state })
			return { waited: true }
		},
		['wait', 'selector', 'visible']
	),
	defineEvent(
		'page.waitForTimeout',
		'Wait for a fixed timeout',
		z.object({
			timeoutMs: z.number().min(0).describe('Time to wait in milliseconds'),
		}),
		async ({ page }, input) => {
			await page.waitForTimeout(input.timeoutMs)
			return { waited: true }
		},
		['wait', 'sleep', 'timeout']
	),
	defineEvent(
		'page.setViewportSize',
		'Set page viewport dimensions',
		z.object({
			width: z.number().min(1).describe('Viewport width in CSS pixels'),
			height: z.number().min(1).describe('Viewport height in CSS pixels'),
		}),
		async ({ page }, input) => {
			await page.setViewportSize({ width: input.width, height: input.height })
			return { resized: true }
		},
		['viewport', 'screen', 'size']
	),
	defineEvent(
		'page.screenshot',
		'Capture screenshot of page or element',
		z.object({
			path: z.string().min(1).optional().describe('Optional output path, defaults to temp file when omitted'),
			fullPage: z.boolean().optional().describe('When true, capture full scrollable page'),
			selector: selectorModel.optional().describe('Optional selector for element screenshot instead of whole page'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			const path = getScreenshotPath(input.path)

			if (input.selector !== undefined) {
				const locator = page.locator(input.selector).first()
				await locator.screenshot({ path, timeout: input.timeoutMs })
				return { path, target: 'element' }
			}

			await page.screenshot({ path, fullPage: input.fullPage, timeout: input.timeoutMs })
			return { path, target: 'page' }
		},
		['screenshot', 'image', 'capture']
	),
	defineEvent(
		'page.content',
		'Get current HTML content',
		z.object({}),
		async ({ page }) => await page.content(),
		['html', 'content', 'dom']
	),
	defineEvent(
		'page.title',
		'Get current document title',
		z.object({}),
		async ({ page }) => await page.title(),
		['title', 'meta']
	),
	defineEvent(
		'page.url',
		'Get current URL',
		z.object({}),
		async ({ page }) => page.url(),
		['url', 'location']
	),
	defineEvent(
		'page.textContent',
		'Get textContent for selector',
		z.object({
			selector: selectorModel,
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => await page.textContent(input.selector, { timeout: input.timeoutMs }),
		['text', 'selector']
	),
	defineEvent(
		'page.innerText',
		'Get innerText for selector',
		z.object({
			selector: selectorModel,
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => await page.innerText(input.selector, { timeout: input.timeoutMs }),
		['text', 'selector']
	),
	defineEvent(
		'page.innerHTML',
		'Get innerHTML for selector',
		z.object({
			selector: selectorModel,
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => await page.innerHTML(input.selector, { timeout: input.timeoutMs }),
		['html', 'selector']
	),
	defineEvent(
		'page.getAttribute',
		'Get attribute value from selector',
		z.object({
			selector: selectorModel,
			attribute: z.string().min(1).describe('Attribute name to read from the element'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => await page.getAttribute(input.selector, input.attribute, { timeout: input.timeoutMs }),
		['attribute', 'selector']
	),
	defineEvent(
		'page.isVisible',
		'Check element visibility',
		z.object({
			selector: selectorModel,
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => await page.isVisible(input.selector, { timeout: input.timeoutMs }),
		['visible', 'selector', 'boolean']
	),
	defineEvent(
		'page.isEnabled',
		'Check element enabled state',
		z.object({
			selector: selectorModel,
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => await page.isEnabled(input.selector, { timeout: input.timeoutMs }),
		['enabled', 'selector', 'boolean']
	),
	defineEvent(
		'page.isChecked',
		'Check checkbox/radio checked state',
		z.object({
			selector: selectorModel,
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => await page.isChecked(input.selector, { timeout: input.timeoutMs }),
		['checked', 'selector', 'boolean']
	),
	defineEvent(
		'page.count',
		'Count elements matching selector',
		z.object({
			selector: selectorModel,
		}),
		async ({ page }, input) => await page.locator(input.selector).count(),
		['count', 'selector']
	),
	defineEvent(
		'page.boundingBox',
		'Get element bounding box',
		z.object({
			selector: selectorModel,
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => await page.locator(input.selector).first().boundingBox({ timeout: input.timeoutMs }),
		['box', 'bounds', 'selector']
	),
	defineEvent(
		'page.evaluate',
		'Evaluate JS expression in page context',
		z.object({
			expression: z.string().min(1).describe('JavaScript expression string that evaluates to a function body'),
			argJson: z.string().optional().describe('Optional JSON argument passed to the expression as arg'),
		}),
		async ({ page }, input) => {
			const arg = parseArgJson(input.argJson)
			// eslint-disable-next-line no-new-func
			const fn = new Function('arg', `return (${input.expression})`) as (arg: unknown) => unknown
			return await page.evaluate(fn, arg)
		},
		['evaluate', 'javascript', 'script']
	),
	defineEvent(
		'page.console.list',
		'Read captured browser console entries',
		z.object({
			type: z.string().optional().describe('Optional console type filter such as log, warn, or error'),
			limit: z.number().min(1).optional().describe('Optional max number of messages to return'),
			clear: z.boolean().optional().describe('When true, clear stored console entries after this read'),
		}),
		async ({ runtime }, input) => {
			let entries = runtime.consoleEntries
			if (input.type !== undefined) entries = entries.filter(entry => entry.type === input.type)
			if (input.limit !== undefined) entries = entries.slice(Math.max(0, entries.length - input.limit))
			const result = entries
			if (input.clear) runtime.consoleEntries = []
			return result
		},
		['console', 'logs', 'errors', 'browser']
	),
	defineEvent(
		'page.errors.list',
		'Read captured page runtime errors',
		z.object({
			limit: z.number().min(1).optional().describe('Optional max number of errors to return'),
			clear: z.boolean().optional().describe('When true, clear stored page errors after this read'),
		}),
		async ({ runtime }, input) => {
			let entries = runtime.pageErrors
			if (input.limit !== undefined) entries = entries.slice(Math.max(0, entries.length - input.limit))
			const result = entries
			if (input.clear) runtime.pageErrors = []
			return result
		},
		['console', 'errors', 'pageerror', 'runtime']
	),
] as const


/*
Implemented all Playwright Page methods except methods that require callback registration,
routing handlers, frame/locator handle composition, or other highly dynamic runtime values:
  'exposeBinding'
  'exposeFunction'
  'removeAllListeners'
  'on'
  'once'
  'addListener'
  'removeListener'
  'off'
  'prependListener'
  'addLocatorHandler'
  'removeLocatorHandler'
  'route'
  'routeFromHAR'
  'routeWebSocket'
  'unroute'
  'unrouteAll'
  'waitForEvent'
  'waitForRequest'
  'waitForResponse'
  'frame'
  'frameLocator'
  'frames'
  'locator'
  'getByAltText'
  'getByLabel'
  'getByPlaceholder'
  'getByRole'
  'getByTestId'
  'getByText'
  'getByTitle'
  'context'
  'mainFrame'
  'opener'
  'video'
  'workers'
*/

const pageMethodEvents = [
defineEvent(
		'page.bringToFront',
		'Bring the page tab to the foreground',
		z.object({}),
		async ({ page }) => {
			await page.bringToFront()
			return { broughtToFront: true }
		},
		['page', 'focus', 'tab']
	),
	defineEvent(
		'page.close',
		'Close the current page',
		z.object({
			runBeforeUnload: z.boolean().optional().describe('When true, run beforeunload handlers'),
		}),
		async ({ page }, input) => {
			await page.close({ runBeforeUnload: input.runBeforeUnload })
			return { closed: true }
		},
		['page', 'close']
	),
	defineEvent(
		'page.consoleMessages',
		'Read browser console messages from Playwright page API',
		z.object({}),
		async ({ page }) => sanitizeForTransport(await page.consoleMessages()),
		['console', 'logs']
	),
	defineEvent(
		'page.dispatchEvent',
		'Dispatch a DOM event on an element',
		z.object({
			selector: z.string().min(1).describe('Target selector for the DOM event'),
			type: z.string().min(1).describe('DOM event type such as click or input'),
			eventInitJson: z.string().optional().describe('Optional JSON object for event init payload'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			const init = parseJsonObject(input.eventInitJson, 'eventInitJson')
			await page.dispatchEvent(input.selector, input.type, init, { timeout: input.timeoutMs })
			return { dispatched: true }
		},
		['dom', 'event', 'dispatch']
	),
	defineEvent(
		'page.dragAndDrop',
		'Drag an element and drop it onto another element',
		z.object({
			sourceSelector: z.string().min(1).describe('Selector for source element'),
			targetSelector: z.string().min(1).describe('Selector for target element'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.dragAndDrop(input.sourceSelector, input.targetSelector, { timeout: input.timeoutMs })
			return { dragged: true }
		},
		['drag', 'drop']
	),
	defineEvent(
		'page.emulateMedia',
		'Emulate media settings such as color scheme or reduced motion',
		z.object({
			media: z.union([z.literal('screen'), z.literal('print'), z.literal('null')]).optional().describe('Media type or null'),
			colorScheme: z.union([z.literal('light'), z.literal('dark'), z.literal('no-preference'), z.literal('null')]).optional().describe('Optional color scheme emulation'),
			reducedMotion: z.union([z.literal('reduce'), z.literal('no-preference'), z.literal('null')]).optional().describe('Optional reduced-motion emulation'),
		}),
		async ({ page }, input) => {
			await page.emulateMedia({
				media: input.media === 'null' ? null : input.media,
				colorScheme: input.colorScheme === 'null' ? null : input.colorScheme,
				reducedMotion: input.reducedMotion === 'null' ? null : input.reducedMotion,
			})
			return { emulated: true }
		},
		['media', 'emulation']
	),
	defineEvent(
		'page.addScriptTag',
		'Inject a script tag into the document',
		z.object({
			url: z.string().optional().describe('Optional script URL'),
			path: z.string().optional().describe('Optional local file path to script'),
			content: z.string().optional().describe('Optional inline script content'),
			type: z.string().optional().describe('Optional script type attribute'),
		}),
		async ({ page }, input) => {
			const element = await page.addScriptTag({
				url: input.url,
				path: input.path,
				content: input.content,
				type: input.type,
			})
			return sanitizeForTransport(await element.evaluate(el => (el as { outerHTML?: string }).outerHTML))
		},
		['script', 'inject']
	),
	defineEvent(
		'page.addStyleTag',
		'Inject a style tag into the document',
		z.object({
			url: z.string().optional().describe('Optional stylesheet URL'),
			path: z.string().optional().describe('Optional local file path to stylesheet'),
			content: z.string().optional().describe('Optional inline stylesheet content'),
		}),
		async ({ page }, input) => {
			const element = await page.addStyleTag({
				url: input.url,
				path: input.path,
				content: input.content,
			})
			return sanitizeForTransport(await element.evaluate(el => (el as { outerHTML?: string }).outerHTML))
		},
		['style', 'inject']
	),
	defineEvent(
		'page.inputValue',
		'Read current form input value for a selector',
		z.object({
			selector: z.string().min(1).describe('Target selector'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => await page.inputValue(input.selector, { timeout: input.timeoutMs }),
		['input', 'value']
	),
	defineEvent(
		'page.isClosed',
		'Check whether the page has been closed',
		z.object({}),
		async ({ page }) => page.isClosed(),
		['page', 'status']
	),
	defineEvent(
		'page.isDisabled',
		'Check whether a form control is disabled',
		z.object({
			selector: z.string().min(1).describe('Target selector'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => await page.isDisabled(input.selector, { timeout: input.timeoutMs }),
		['disabled', 'selector']
	),
	defineEvent(
		'page.isEditable',
		'Check whether an element is editable',
		z.object({
			selector: z.string().min(1).describe('Target selector'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => await page.isEditable(input.selector, { timeout: input.timeoutMs }),
		['editable', 'selector']
	),
	defineEvent(
		'page.isHidden',
		'Check whether an element is hidden',
		z.object({
			selector: z.string().min(1).describe('Target selector'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => await page.isHidden(input.selector, { timeout: input.timeoutMs }),
		['hidden', 'selector']
	),
	defineEvent(
		'page.pageErrors',
		'Read page runtime errors from Playwright page API',
		z.object({}),
		async ({ page }) => sanitizeForTransport(await page.pageErrors()),
		['errors', 'runtime']
	),
	defineEvent(
		'page.pause',
		'Pause script execution in Playwright inspector',
		z.object({}),
		async ({ page }) => {
			await page.pause()
			return { paused: true }
		},
		['debug', 'pause']
	),
	defineEvent(
		'page.pdf',
		'Generate a PDF snapshot of the page',
		z.object({
			path: z.string().optional().describe('Optional output path'),
			format: z.string().optional().describe('Optional paper format such as A4'),
			landscape: z.boolean().optional().describe('When true, use landscape orientation'),
			printBackground: z.boolean().optional().describe('When true, include background graphics'),
		}),
		async ({ page }, input) => {
			const bytes = await page.pdf({
				path: input.path,
				format: input.format as any,
				landscape: input.landscape,
				printBackground: input.printBackground,
			})
			return { bytes: bytes.byteLength, path: input.path ?? null }
		},
		['pdf', 'print']
	),
	defineEvent(
		'page.requestGC',
		'Trigger JavaScript garbage collection in the page',
		z.object({}),
		async ({ page }) => {
			await page.requestGC()
			return { requested: true }
		},
		['gc', 'memory']
	),
	defineEvent(
		'page.requests',
		'Read tracked network requests from Playwright page API',
		z.object({}),
		async ({ page }) => sanitizeForTransport(await page.requests()),
		['network', 'requests']
	),
	defineEvent(
		'page.setChecked',
		'Set checkbox/radio checked state',
		z.object({
			selector: z.string().min(1).describe('Target selector'),
			checked: z.boolean().describe('Desired checked state'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.setChecked(input.selector, input.checked, { timeout: input.timeoutMs })
			return { checked: input.checked }
		},
		['checkbox', 'radio']
	),
	defineEvent(
		'page.setContent',
		'Replace current page content with HTML',
		z.object({
			html: z.string().describe('HTML content to inject'),
			waitUntil: z.union([z.literal('commit'), z.literal('domcontentloaded'), z.literal('load'), z.literal('networkidle')]).optional().describe('Optional lifecycle state to wait for'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.setContent(input.html, { waitUntil: input.waitUntil, timeout: input.timeoutMs })
			return { set: true }
		},
		['html', 'content']
	),
	defineEvent(
		'page.setDefaultNavigationTimeout',
		'Set default navigation timeout for this page',
		z.object({
			timeoutMs: z.number().min(0).describe('Default navigation timeout in milliseconds'),
		}),
		async ({ page }, input) => {
			page.setDefaultNavigationTimeout(input.timeoutMs)
			return { timeoutMs: input.timeoutMs }
		},
		['timeout', 'navigation']
	),
	defineEvent(
		'page.setDefaultTimeout',
		'Set default timeout for this page',
		z.object({
			timeoutMs: z.number().min(0).describe('Default timeout in milliseconds'),
		}),
		async ({ page }, input) => {
			page.setDefaultTimeout(input.timeoutMs)
			return { timeoutMs: input.timeoutMs }
		},
		['timeout']
	),
	defineEvent(
		'page.setExtraHTTPHeaders',
		'Set extra HTTP headers for page requests',
		z.object({
			headersJson: z.string().describe('JSON object map of header names to values'),
		}),
		async ({ page }, input) => {
			const headers = parseJsonObject(input.headersJson, 'headersJson') ?? {}
			await page.setExtraHTTPHeaders(headers as Record<string, string>)
			return { set: true, count: Object.keys(headers).length }
		},
		['headers', 'http']
	),
	defineEvent(
		'page.tap',
		'Tap an element (touch emulation)',
		z.object({
			selector: z.string().min(1).describe('Target selector'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.tap(input.selector, { timeout: input.timeoutMs })
			return { tapped: true }
		},
		['tap', 'touch']
	),
	defineEvent(
		'page.viewportSize',
		'Get current viewport size',
		z.object({}),
		async ({ page }) => page.viewportSize(),
		['viewport', 'size']
	),
	defineEvent(
		'page.waitForLoadState',
		'Wait for a given load state',
		z.object({
			state: z.union([z.literal('domcontentloaded'), z.literal('load'), z.literal('networkidle')]).optional().describe('Optional target load state'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.waitForLoadState(input.state, { timeout: input.timeoutMs })
			return { waited: true }
		},
		['wait', 'load']
	),
	defineEvent(
		'page.waitForNavigation',
		'Wait for page navigation',
		z.object({
			url: z.string().optional().describe('Optional URL to match'),
			waitUntil: z.union([z.literal('commit'), z.literal('domcontentloaded'), z.literal('load'), z.literal('networkidle')]).optional().describe('Optional lifecycle state to wait for'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.waitForNavigation({ url: input.url, waitUntil: input.waitUntil, timeout: input.timeoutMs })
			return { waited: true, url: page.url() }
		},
		['wait', 'navigation']
	),
	defineEvent(
		'page.waitForURL',
		'Wait until page URL matches a pattern',
		z.object({
			url: z.string().min(1).describe('URL or URL pattern string'),
			waitUntil: z.union([z.literal('commit'), z.literal('domcontentloaded'), z.literal('load'), z.literal('networkidle')]).optional().describe('Optional lifecycle state to wait for'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.waitForURL(input.url, { waitUntil: input.waitUntil, timeout: input.timeoutMs })
			return { waited: true, url: page.url() }
		},
		['wait', 'url']
	),
] as const

export const pageEvents = [...corePageEvents, ...pageMethodEvents]
