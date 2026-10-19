/**
 * Ambient shims for the Node built-ins the host half touches. The package
 * runs inside the dsh host (Node >= 22) but keeps its dev tree free of
 * `@types/node`; these loose declarations exist only so `tsc` can resolve
 * the names for the checkJs pass and declaration emit. They are
 * intentionally permissive — runtime shapes are guaranteed by the host,
 * not re-modeled here. Mirrors the peer-modules shim pattern next door.
 */
declare module "node:module" {
	export function createRequire(path: string): { resolve: (specifier: string) => string };
}
declare module "node:fs" {
	export function readFileSync(path: string, encoding: string): string;
	export function writeFileSync(path: string, data: string, encoding: string): void;
}
declare module "node:path" {
	export function dirname(path: string): string;
	export function join(...parts: string[]): string;
}
declare var process: any;
declare var Buffer: any;
