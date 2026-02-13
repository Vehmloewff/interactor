import { z } from 'zod'

import { defineEvent } from './define-event'
import { parseJsonArray, parseJsonObject, timeoutMsOptionalModel } from './method-utils'

/*
Implemented all Playwright Locator methods except methods that require callback registration
or other highly dynamic runtime values:
  'elementHandle'
  'elementHandles'
  'all'
  'and'
  'or'
  'first'
  'last'
  'nth'
  'locator'
  'frameLocator'
  'contentFrame'
  'page'
  'describe'
  'description'
  'toString'
  'getByAltText'
  'getByLabel'
  'getByPlaceholder'
  'getByRole'
  'getByTestId'
  'getByText'
  'getByTitle'
*/

export const locatorEvents = [
	defineEvent(
		'locator.check',
		'Check a checkbox/radio input matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.locator(input.selector).check({ timeout: input.timeoutMs })
			return { checked: true }
		},
		['locator', 'check']
	),
	defineEvent(
		'locator.click',
		'Click an element matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			button: z.union([z.literal('left'), z.literal('middle'), z.literal('right')]).optional().describe('Optional mouse button'),
			clickCount: z.number().min(1).optional().describe('Optional click count'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.locator(input.selector).click({
				button: input.button,
				clickCount: input.clickCount,
				timeout: input.timeoutMs,
			})
			return { clicked: true }
		},
		['locator', 'click']
	),
	defineEvent(
		'locator.count',
		'Count elements matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
		}),
		async ({ page }, input) => await page.locator(input.selector).count(),
		['locator', 'count']
	),
	defineEvent(
		'locator.dblclick',
		'Double-click an element matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			button: z.union([z.literal('left'), z.literal('middle'), z.literal('right')]).optional().describe('Optional mouse button'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.locator(input.selector).dblclick({
				button: input.button,
				timeout: input.timeoutMs,
			})
			return { clicked: true }
		},
		['locator', 'dblclick']
	),
	defineEvent(
		'locator.fill',
		'Fill an input matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			value: z.string().describe('Text value to set'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.locator(input.selector).fill(input.value, { timeout: input.timeoutMs })
			return { filled: true }
		},
		['locator', 'fill']
	),
	defineEvent(
		'locator.filter',
		'Apply text-based filter to locator and return summary',
		z.object({
			selector: z.string().min(1).describe('Base selector for locator'),
			hasText: z.string().optional().describe('Optional text that matched elements must contain'),
			hasNotText: z.string().optional().describe('Optional text that matched elements must not contain'),
		}),
		async ({ page }, input) => {
			const filtered = page.locator(input.selector).filter({
				hasText: input.hasText,
				hasNotText: input.hasNotText,
			})
			return { count: await filtered.count(), selector: filtered.toString() }
		},
		['locator', 'filter']
	),
	defineEvent(
		'locator.focus',
		'Focus an element matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.locator(input.selector).focus({ timeout: input.timeoutMs })
			return { focused: true }
		},
		['locator', 'focus']
	),
	defineEvent(
		'locator.getAttribute',
		'Read an attribute from an element matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			attribute: z.string().min(1).describe('Attribute name'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => await page.locator(input.selector).getAttribute(input.attribute, { timeout: input.timeoutMs }),
		['locator', 'attribute']
	),
	defineEvent(
		'locator.hover',
		'Hover an element matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.locator(input.selector).hover({ timeout: input.timeoutMs })
			return { hovered: true }
		},
		['locator', 'hover']
	),
	defineEvent(
		'locator.innerHTML',
		'Get innerHTML from an element matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => await page.locator(input.selector).innerHTML({ timeout: input.timeoutMs }),
		['locator', 'html']
	),
	defineEvent(
		'locator.innerText',
		'Get innerText from an element matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => await page.locator(input.selector).innerText({ timeout: input.timeoutMs }),
		['locator', 'text']
	),
	defineEvent(
		'locator.inputValue',
		'Get input value from an element matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => await page.locator(input.selector).inputValue({ timeout: input.timeoutMs }),
		['locator', 'input']
	),
	defineEvent(
		'locator.isChecked',
		'Check checked state for an element matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => await page.locator(input.selector).isChecked({ timeout: input.timeoutMs }),
		['locator', 'checked']
	),
	defineEvent(
		'locator.isDisabled',
		'Check disabled state for an element matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => await page.locator(input.selector).isDisabled({ timeout: input.timeoutMs }),
		['locator', 'disabled']
	),
	defineEvent(
		'locator.isEditable',
		'Check editable state for an element matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => await page.locator(input.selector).isEditable({ timeout: input.timeoutMs }),
		['locator', 'editable']
	),
	defineEvent(
		'locator.isEnabled',
		'Check enabled state for an element matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => await page.locator(input.selector).isEnabled({ timeout: input.timeoutMs }),
		['locator', 'enabled']
	),
	defineEvent(
		'locator.isHidden',
		'Check hidden state for an element matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => await page.locator(input.selector).isHidden({ timeout: input.timeoutMs }),
		['locator', 'hidden']
	),
	defineEvent(
		'locator.isVisible',
		'Check visible state for an element matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => await page.locator(input.selector).isVisible({ timeout: input.timeoutMs }),
		['locator', 'visible']
	),
	defineEvent(
		'locator.press',
		'Press a keyboard key on an element matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			key: z.string().min(1).describe('Keyboard key name'),
			delayMs: z.number().min(0).optional().describe('Optional key press delay in milliseconds'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.locator(input.selector).press(input.key, { delay: input.delayMs, timeout: input.timeoutMs })
			return { pressed: true }
		},
		['locator', 'press']
	),
	defineEvent(
		'locator.pressSequentially',
		'Type text sequentially on an element matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			text: z.string().describe('Text to type sequentially'),
			delayMs: z.number().min(0).optional().describe('Optional delay between keystrokes'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.locator(input.selector).pressSequentially(input.text, { delay: input.delayMs, timeout: input.timeoutMs })
			return { typed: true }
		},
		['locator', 'type']
	),
	defineEvent(
		'locator.screenshot',
		'Capture screenshot of an element matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			path: z.string().optional().describe('Optional output image path'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			const bytes = await page.locator(input.selector).screenshot({ path: input.path, timeout: input.timeoutMs })
			return { bytes: bytes.byteLength, path: input.path ?? null }
		},
		['locator', 'screenshot']
	),
	defineEvent(
		'locator.selectOption',
		'Select option values in an element matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			valuesJson: z.string().describe('JSON array of option values to select'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			const values = parseJsonArray(input.valuesJson, 'valuesJson') as string[]
			return await page.locator(input.selector).selectOption(values, { timeout: input.timeoutMs })
		},
		['locator', 'select']
	),
	defineEvent(
		'locator.setChecked',
		'Set checked state for a checkbox/radio matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			checked: z.boolean().describe('Desired checked state'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.locator(input.selector).setChecked(input.checked, { timeout: input.timeoutMs })
			return { checked: input.checked }
		},
		['locator', 'checked']
	),
	defineEvent(
		'locator.setInputFiles',
		'Upload files using a file input matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			pathsJson: z.string().describe('JSON array of file path strings'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			const paths = parseJsonArray(input.pathsJson, 'pathsJson') as string[]
			await page.locator(input.selector).setInputFiles(paths, { timeout: input.timeoutMs })
			return { attached: paths.length }
		},
		['locator', 'upload']
	),
	defineEvent(
		'locator.tap',
		'Tap an element matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.locator(input.selector).tap({ timeout: input.timeoutMs })
			return { tapped: true }
		},
		['locator', 'tap']
	),
	defineEvent(
		'locator.textContent',
		'Get textContent from an element matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => await page.locator(input.selector).textContent({ timeout: input.timeoutMs }),
		['locator', 'text']
	),
	defineEvent(
		'locator.type',
		'Type text into an element matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			text: z.string().describe('Text to type'),
			delayMs: z.number().min(0).optional().describe('Optional delay between keystrokes'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.locator(input.selector).type(input.text, { delay: input.delayMs, timeout: input.timeoutMs })
			return { typed: true }
		},
		['locator', 'type']
	),
	defineEvent(
		'locator.uncheck',
		'Uncheck a checkbox matched by locator',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.locator(input.selector).uncheck({ timeout: input.timeoutMs })
			return { checked: false }
		},
		['locator', 'uncheck']
	),
	defineEvent(
		'locator.allInnerTexts',
		'Get innerText for all elements matching selector',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
		}),
		async ({ page }, input) => await page.locator(input.selector).allInnerTexts(),
		['locator', 'text']
	),
	defineEvent(
		'locator.allTextContents',
		'Get textContent values for all elements matching selector',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
		}),
		async ({ page }, input) => await page.locator(input.selector).allTextContents(),
		['locator', 'text']
	),
	defineEvent(
		'locator.ariaSnapshot',
		'Get ARIA snapshot for an element',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
		}),
		async ({ page }, input) => await page.locator(input.selector).ariaSnapshot(),
		['locator', 'aria']
	),
	defineEvent(
		'locator.blur',
		'Blur the focused state of an element',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
		}),
		async ({ page }, input) => {
			await page.locator(input.selector).blur()
			return { blurred: true }
		},
		['locator', 'focus']
	),
	defineEvent(
		'locator.boundingBox',
		'Get element bounding box for selector',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => await page.locator(input.selector).boundingBox({ timeout: input.timeoutMs }),
		['locator', 'bounds']
	),
	defineEvent(
		'locator.clear',
		'Clear text from an input-like element',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.locator(input.selector).clear({ timeout: input.timeoutMs })
			return { cleared: true }
		},
		['locator', 'input']
	),
	defineEvent(
		'locator.dispatchEvent',
		'Dispatch a DOM event on a locator element',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			type: z.string().min(1).describe('DOM event type'),
			eventInitJson: z.string().optional().describe('Optional JSON object for event init payload'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			const init = parseJsonObject(input.eventInitJson, 'eventInitJson')
			await page.locator(input.selector).dispatchEvent(input.type, init, { timeout: input.timeoutMs })
			return { dispatched: true }
		},
		['locator', 'event']
	),
	defineEvent(
		'locator.dragTo',
		'Drag one locator element to another locator element',
		z.object({
			sourceSelector: z.string().min(1).describe('Source selector'),
			targetSelector: z.string().min(1).describe('Target selector'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.locator(input.sourceSelector).dragTo(page.locator(input.targetSelector), { timeout: input.timeoutMs })
			return { dragged: true }
		},
		['locator', 'drag', 'drop']
	),
	defineEvent(
		'locator.highlight',
		'Temporarily highlight locator element in inspector',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
		}),
		async ({ page }, input) => {
			await page.locator(input.selector).highlight()
			return { highlighted: true }
		},
		['locator', 'debug']
	),
	defineEvent(
		'locator.scrollIntoViewIfNeeded',
		'Scroll locator element into view when needed',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.locator(input.selector).scrollIntoViewIfNeeded({ timeout: input.timeoutMs })
			return { scrolled: true }
		},
		['locator', 'scroll']
	),
	defineEvent(
		'locator.selectText',
		'Select text content inside a locator element',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.locator(input.selector).selectText({ timeout: input.timeoutMs })
			return { selected: true }
		},
		['locator', 'text', 'select']
	),
	defineEvent(
		'locator.waitFor',
		'Wait for locator element state',
		z.object({
			selector: z.string().min(1).describe('Target selector for locator'),
			state: z.union([z.literal('attached'), z.literal('detached'), z.literal('hidden'), z.literal('visible')]).optional().describe('Desired locator state'),
			timeoutMs: timeoutMsOptionalModel,
		}),
		async ({ page }, input) => {
			await page.locator(input.selector).waitFor({
				state: input.state,
				timeout: input.timeoutMs,
			})
			return { waited: true }
		},
		['locator', 'wait']
	),
] as const
