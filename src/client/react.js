/** React externals as a real module: the host's require provides both
 *  specifiers (see the dsh.client contract), esbuild leaves them external,
 *  and the factory envelope scopes the calls. */
export { useState, useEffect, useMemo, useRef, useSyncExternalStore, forwardRef } from "react";
export { jsx, jsxs } from "react/jsx-runtime";
