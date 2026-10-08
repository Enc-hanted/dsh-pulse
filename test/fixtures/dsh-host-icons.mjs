/**
 * Frozen snapshot of the host icon names this plugin consumes or aliases,
 * for the icon ledger in style-test.mjs.
 *
 * Provenance: verified against the dsh packages present on this machine —
 * dsh-client-ui-primitives@0.1.0-rc.7 (size-suffixed family) and
 * @0.1.7-rc.2 (stroke-weight family), each package's icons type surface.
 * Extend when a new host generation is audited; a name absent here must
 * carry a LEGACY_ICON_ALIASES entry in adapter.js (or be added here) before
 * a call site may reference it.
 */
export const HOST_ICON_NAMES = new Set([
	// 0.1.0-rc.7 — size-suffixed family
	"IconChevronDownOutline14",
	"IconChevronUpOutline14",
	"IconCloseOutline16",
	"IconDataOutline16",
	"IconDownloadOutline16",
	"IconRefreshOutline16",
	"IconSearchOutline16",
	"IconWarningOutline16",
	// 0.1.7-rc.2 — stroke-weight family
	"IconChevronDownOutlineMedium",
	"IconChevronUpOutlineMedium",
	"IconClockOutlineMedium",
	"IconCloseOutlineMedium",
	"IconDataOutlineMedium",
	"IconDownloadOutlineMedium",
	"IconRefreshOutlineMedium",
	"IconSearchOutlineMedium",
	"IconWarningOutlineMedium",
]);
