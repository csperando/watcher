// ---------- 2. getScreenDetails() ----------
import { VM_HINTS } from "./vmSignal.js";
import { isNativeFunction } from "./nativeCode.js";
import { getPristine } from "./pristine.js";

export function isScreenDetailsSupported() {
    return "getScreenDetails" in window;
}

export async function requestScreenDetails() {
    return window.getScreenDetails();
}

export function shapeScreens(screens) {
    return screens.map((s) => ({
        label: s.label,
        width: s.width,
        height: s.height,
        left: s.left,
        top: s.top,
        isPrimary: s.isPrimary,
        isInternal: s.isInternal,
        devicePixelRatio: s.devicePixelRatio
    }));
}

export function shapeScreensLive(screens) {
    return screens.map((s) => ({ label: s.label, width: s.width, height: s.height, left: s.left, top: s.top }));
}

// screen.label is a free-form string the OS hands the browser (e.g. this
// VM reports "VBOX monitor") — a getter on ScreenDetailed.prototype, same
// spoofable shape as screen.isExtended. Not a strong signal on its own
// (spoofable, and legitimate hardware sometimes reports generic labels
// too), but most stealth tooling doesn't think to fake this specifically,
// so it's a cheap extra check alongside method 8's renderer-string hints.
export function detectLabelHints(screens) {
    const matches = screens
        .map((s, index) => ({
            index,
            label: s.label,
            hint: VM_HINTS.find((h) => (s.label || "").toLowerCase().includes(h))
        }))
        .filter((m) => m.hint);
    return { anyHint: matches.length > 0, matches };
}

// The label hint above only works if the label is real. A spoof replaces
// ScreenDetailed.prototype.label's getter (or shadows it on a screen object)
// to report a plausible name like "Generic PnP Monitor". Same two-part
// native check as method 6 (nativeCode.js): source text against the
// pristine realm's getter, plus the toString-independent behavior probe.
export function checkLabelGetter(screens) {
    if (!("ScreenDetailed" in window)) return null;
    const descriptor = Object.getOwnPropertyDescriptor(ScreenDetailed.prototype, "label");
    const pristine = getPristine();
    const getterNative = !!descriptor && isNativeFunction(descriptor.get, pristine && pristine.screenDetailedLabel);
    const shadowedOnScreen = screens.some((s) => Object.prototype.hasOwnProperty.call(s, "label"));
    return { getterNative, shadowedOnScreen, spoofed: !getterNative || shadowedOnScreen };
}
