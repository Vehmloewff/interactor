import { createRequire } from 'node:module'

type RegistryExecutable = unknown

type PlaywrightRegistry = {
	resolveBrowsers: (browsers: string[], options: { shell?: 'only' | 'no' | undefined }) => RegistryExecutable[]
	installDeps: (executables: RegistryExecutable[], dryRun: boolean) => Promise<void>
	calculateDownloadTitle: (executable: RegistryExecutable) => string
	install: (executables: RegistryExecutable[], options: { force?: boolean }) => Promise<void>
	validateHostRequirementsForExecutablesIfNeeded: (executables: RegistryExecutable[], sdkLanguage: string) => Promise<void>
}

export type InstallPlaywrightBrowsersOptions = {
	browsers?: string[]
	force?: boolean
	withDeps?: boolean
	dryRun?: boolean
	onlyShell?: boolean
	noShell?: boolean
}

function getRegistry(): PlaywrightRegistry {
	const require = createRequire(import.meta.url)
	const mod = require('playwright-core/lib/server') as { registry?: PlaywrightRegistry }
	if (!mod.registry) {
		throw new Error('Unable to load Playwright registry API')
	}
	return mod.registry
}

function resolveShellOption(options: InstallPlaywrightBrowsersOptions): 'only' | 'no' | undefined {
	if (options.onlyShell && options.noShell) {
		throw new Error('Only one of "onlyShell" and "noShell" can be enabled')
	}
	if (options.onlyShell) return 'only'
	if (options.noShell) return 'no'
	return undefined
}

export async function installPlaywrightBrowsers(options: InstallPlaywrightBrowsersOptions = {}): Promise<void> {
	const registry = getRegistry()
	const browsers = options.browsers ?? ['chromium']
	const shell = resolveShellOption(options)
	const executables = registry.resolveBrowsers(browsers, { shell })

	if (options.withDeps) {
		await registry.installDeps(executables, Boolean(options.dryRun))
	}

	if (options.dryRun) {
		for (const executable of executables) {
			console.log(registry.calculateDownloadTitle(executable))
		}
		return
	}

	await registry.install(executables, { force: options.force })
	await registry.validateHostRequirementsForExecutablesIfNeeded(executables, process.env.PW_LANG_NAME || 'javascript').catch(error => {
		console.warn('Playwright host validation warning:', error)
	})
}

export async function installPlaywrightBrowser(browser: string = 'chromium'): Promise<void> {
	await installPlaywrightBrowsers({ browsers: [browser] })
}
