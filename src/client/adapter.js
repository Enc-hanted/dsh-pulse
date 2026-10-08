/**
 * Ui adapter — the ONLY module that touches host-provided externals beyond
 * react. Every other module imports controls from here, so capability
 * detection and fallbacks have exactly one home (and the declaration order
 * of the old flat bundle can no longer produce a TDZ: imports hoist).
 *
 * The legacy-icon proxy aliases pre-0.1.7 size-suffixed icon names onto the
 * stroke-weight variants; an icon the running host provides under neither
 * name degrades to a no-op component instead of killing the mounting slot.
 */
import * as primitivesModule from "@deepseek-ai/dsh-client-ui-primitives";
import { forwardRef, useRef, jsx, jsxs } from "./react.js";

		export const LEGACY_ICON_ALIASES = {
			IconChevronDownOutline14: "IconChevronDownOutlineMedium",
			IconChevronUpOutline14: "IconChevronUpOutlineMedium",
			IconClockOutline16: "IconClockOutlineMedium",
			IconCloseOutline16: "IconCloseOutlineMedium",
			IconDataOutline16: "IconDataOutlineMedium",
			IconDownloadOutline16: "IconDownloadOutlineMedium",
			IconRefreshOutline16: "IconRefreshOutlineMedium",
			IconSearchOutline16: "IconSearchOutlineMedium",
			IconWarningOutline16: "IconWarningOutlineMedium",
		};
		export const noopIcon = () => null;
		export const primitives = new Proxy(primitivesModule, {
			get(target, prop) {
				if (prop in target) return target[prop];
				if (typeof prop === "string" && Object.prototype.hasOwnProperty.call(LEGACY_ICON_ALIASES, prop)) {
					const modern = target[LEGACY_ICON_ALIASES[prop]];
					return modern !== undefined ? modern : noopIcon;
				}
				// Any other icon name (a host rename, a call site that forgot its
				// alias entry) degrades to the no-op icon — jsx(undefined) would
				// kill the whole mounting slot, which the header comment promises
				// never happens for icons. Non-icon names still fail loud.
				if (typeof prop === "string" && /^Icon[A-Z]/.test(prop)) return noopIcon;
				return undefined;
			},
		});
		/** Host tooltip primitive (0.1.7+ primitives): the official-styled hover
		 *  bubble every dsh surface uses. Null on hosts whose primitives predate
		 *  it — call sites then fall back to native `title` attributes.
		 *  MUST stay below the proxy: reading `primitives` above its `const`
		 *  throws a TDZ ReferenceError while the host evaluates this bundle,
		 *  which kills every client surface of the plugin (and the page). */
		export const TooltipPrim = primitives.Tooltip ?? null;
		/** Official hover preview card (0.1.7+ primitives): anchor + portaled
		 *  card, used by the break analyzer's turn hover. Null on older hosts —
		 *  the call site falls back to a self-drawn floating tag. */
		export const HoverCardPrim = primitives.HoverCard ?? null;
		/** Official relative-time bucketing (unit + magnitude); the words stay
		 *  in this plugin's dictionary. Null on older hosts — call sites hide
		 *  the trailing label. */
		export const relativeTimePrim = primitives.relativeTime ?? null;


/** Reactive store engine behind slot store seats (0.1.7+). Absent on older
 *  hosts, where every store-seat feature degrades to render-site props; the
 *  optional require lives in the factory envelope (globalThis.__dshPulseHost). */
export const defineStore = globalThis.__dshPulseHost?.defineStore ?? null;
/** The snapshot bus the local preference stores ride (panels/theme/overlay),
 *  same engine and same envelope bridge; null falls back to the handwritten
 *  snapshot+Set bus in stores.js. */
export const createSnapshotStore = globalThis.__dshPulseHost?.createSnapshotStore ?? null;
/** Portal capability for anchored floats (P3): createPortal when the host
 *  serves react-dom, else floats render inline (fixed positioning accepts
 *  transformed-ancestor risk only where the caller has none). */
export const createPortal = globalThis.__dshPulseHost?.reactDom?.createPortal ?? null;

/** Segmented control (P1): the official SegmentedControl when the host's
 *  primitives carry it, otherwise the exact hand-rolled group this bundle
 *  shipped before the migration — old hosts keep today's markup, styling and
 *  aria (`role=group` + `aria-pressed`) while new hosts get the official
 *  tablist with roving arrow-key focus. Contract matches the official
 *  control: `options` are `{value, label}` in display order; `id` and
 *  `label` are required (the official control names each segment and the
 *  tablist itself); `className` is for layout placement only; `disabled`
 *  locks the whole control (the fallback folds it into each segment's own
 *  per-option disabled). */
export function Seg({ id, value, options, onChange, label, className, disabled }) {
	const Official = primitives.SegmentedControl;
	if (typeof Official === "function") {
		return jsx(Official, { id, value, options, onChange, label, className, disabled });
	}
	return jsx("div", {
		className: className ? `dp_seg ${className}` : "dp_seg",
		role: "group",
		"aria-label": label,
		children: options.map((option) => jsx("button", {
			type: "button",
			className: `dp_segBtn${option.value === value ? " dp_segBtnActive" : ""}`,
			disabled: disabled === true || option.disabled === true,
			onClick: () => onChange(option.value),
			"aria-pressed": option.value === value,
			children: option.label,
		}, option.value)),
	});
}

/** Button (P1): the official Button (variant/size/icon seat, native props
 *  pass through) with the pre-P1 class kept ONLY for the fallback path, so
 *  old hosts render today's button and new hosts carry no dead class.
 *  `icon` rides the official icon seat and joins the fallback's children.
 *  forwardRef keeps `ref` working in both paths — the official Button is a
 *  ForwardRef component ("native button for focus management and overlay
 *  anchors"), and the fallback forwards to its own native button; without
 *  this, React 18 silently strips the prop and every anchor chained to a
 *  Btn ref (the toolbar's date → calendar Float) loses its anchor. */
export const Btn = forwardRef(function Btn({ variant = "ghost", size = "md", icon, className, fallbackClass = "", children, ...rest }, ref) {
	const Official = primitives.Button;
	if (typeof Official === "function") {
		return jsx(Official, { variant, size, icon, className, ...rest, ref, children });
	}
	const nodes = [icon, children].filter((child) => child !== undefined && child !== null);
	return jsx("button", {
		type: "button",
		ref,
		className: fallbackClass || className,
		...rest,
		children: nodes.length === 1 ? nodes[0] : nodes,
	});
});

/** Pill-style toggle (P1): the official Pill (active state, button when
 *  onClick is given) with the pre-P1 classes on the fallback path. */
export function PillBtn({ active = false, fallbackClass = "dp_miniBtn", fallbackActiveClass = "dp_miniBtnOn", className, children, ...rest }) {
	const Official = primitives.Pill;
	if (typeof Official === "function") {
		return jsx(Official, { active, className, ...rest, children });
	}
	return jsx("button", {
		type: "button",
		className: `${fallbackClass}${active ? ` ${fallbackActiveClass}` : ""}`,
		"aria-pressed": active,
		...rest,
		children,
	});
}

/** Read-only tag (P1): the official Tag with tones; fallback = the pre-P1
 *  badge span (`fallbackClass` carries the full class list). */
export function Tag({ tone = "outline", fallbackClass = "dp_sessBadge", className, children }) {
	const Official = primitives.Tag;
	if (typeof Official === "function") return jsx(Official, { tone, className, children });
	return jsx("span", { className: fallbackClass, children });
}

/** Toggle switch (P2): the official Switch when present; fallback = the
 *  native checkbox the settings pages shipped with. The label stays the
 *  render site's property in both paths. */
export function Switch({ checked, onChange, label, disabled, title, className }) {
	const Official = primitives.Switch;
	if (typeof Official === "function") {
		return jsx(Official, { checked, onChange, label, disabled, title, className });
	}
	return jsx("input", {
		type: "checkbox",
		className: className ?? "dp_setSwitchBox",
		checked,
		disabled,
		title,
		"aria-label": label,
		onChange: (e) => onChange(e.target.checked),
	});
}

/** Labeled checkbox (P2): the official Checkbox (the label lives on the
 *  control); fallback = a label element wrapping the native checkbox,
 *  mirroring the dp_setSwitch rows. Labels with rich children (a status line
 *  under the name, as in the quota provider list) keep their native markup
 *  at the call site — the official contract is a plain-string label. */
export function Checkbox({ checked, onChange, label, disabled, title, className }) {
	const Official = primitives.Checkbox;
	if (typeof Official === "function") {
		return jsx(Official, { checked, onChange, label, disabled, title, className });
	}
	return jsxs("label", {
		className,
		children: [
			jsx("input", {
				type: "checkbox",
				checked,
				disabled,
				title,
				onChange: (e) => onChange(e.target.checked),
			}),
			jsx("span", { children: label }),
		],
	});
}

/** Text input (P2): the official Input wraps the native input in a span and
 *  puts `className` on the WRAPPER — call sites migrating a styled input
 *  must move their input css to the wrapper with it. Native attributes
 *  pass through untouched. */
export function Input({ className, icon, ...rest }) {
	const Official = primitives.Input;
	if (typeof Official === "function") {
		return jsx(Official, { className, icon, ...rest });
	}
	return jsx("input", { className, ...rest });
}

/** Anchored floating panel (P3): MenuSurface material positioned by
 *  useAnchoredPosition (viewport-clamped, re-fits on scroll/resize),
 *  clamped in height by useAnchoredMaxHeight, dismissed by
 *  useDismissOnOutsidePointer. All pieces capability-detected — call sites
 *  ask `floatReady()` and keep their inline shell as the fallback path. */
const noPosition = () => null;
const noMaxHeight = () => 0;
const noDismiss = () => {};
export function floatReady() {
	return typeof primitives.MenuSurface === "function"
		&& typeof primitives.useAnchoredPosition === "function"
		&& typeof primitives.useDismissOnOutsidePointer === "function"
		&& createPortal !== null;
}
export function Float({ open, onClose, rootRef, anchorRef, children, align = "start", gap = 6, maxHeight = 320 }) {
	const panelRef = useRef(null);
	const position = (primitives.useAnchoredPosition ?? noPosition)({ open, anchorRef, panelRef, side: "bottom", align, gap, margin: 8 });
	const cap = (primitives.useAnchoredMaxHeight ?? noMaxHeight)(panelRef, maxHeight, open);
	(primitives.useDismissOnOutsidePointer ?? noDismiss)(rootRef, open && floatReady(), onClose, panelRef);
	if (!open || !floatReady() || position === null) return null;
	return createPortal(jsx(primitives.MenuSurface, {
		ref: panelRef,
		className: "dp_floatPanel",
		style: { ...position, maxHeight: cap > 0 ? cap : undefined },
		children,
	}), document.body);
}
