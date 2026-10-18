/**
 * Ambient shims for peer-provided modules that are not installed on the
 * development tree (the TUI front end is an optional peer). The declarations
 * are intentionally loose: they only let `tsc` resolve the imports so the
 * host-half declarations can emit; the TUI face itself is not part of the
 * shipped type surface.
 */
declare module "@deepseek-harness-tui/dsh-tui" {
	export const tuiScenes: unknown;
	export const tuiPluginHost: unknown;
	export const tuiStatus: unknown;
	export const tuiShortcuts: unknown;
}
