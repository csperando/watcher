// Shared by the isExtended integrity check (method 6) and the webcam page's
// camera-API integrity check.
//
// A native, un-tampered function stringifies to "[native code]". An
// extension or script that overrides it with a fake shows its actual source
// instead — unless it also gives the fake its own `toString` that lies
// about that. Forcing a trusted `toString` onto `fn` via `.call()` skips the
// lookup on `fn` entirely, so a per-function `toString` can't intercept it.
//
// The trusted `toString` comes from a pristine iframe realm (pristine.js),
// so a page-wide override of *this* page's Function.prototype.toString
// can't lie to the check either.
import { getPristine } from "./pristine.js";

function trustedToString() {
    const p = getPristine();
    return p ? p.toString : Function.prototype.toString;
}

// With a `reference` (the same function from the pristine realm), the
// source strings must match exactly. That also catches a Proxy wrapped
// around a native function, which stringifies as an anonymous
// "function () { [native code] }" rather than "function getUserMedia() …".
export function isNativeFunction(fn, reference) {
    if (typeof fn !== "function") return false;
    try {
        const toString = trustedToString();
        const src = toString.call(fn);
        if (typeof reference === "function") return src === toString.call(reference);
        return src.includes("[native code]");
    } catch (err) {
        return false;
    }
}

// True when this page's Function.prototype.toString has itself been
// replaced: it no longer stringifies like the pristine one, or it describes
// a known native function differently. Brave's fingerprint protection does
// this legitimately, so callers treat it as a warning, not proof.
export function isToStringPatched() {
    const p = getPristine();
    if (!p) return null;
    try {
        const pageToString = Function.prototype.toString;
        return p.toString.call(pageToString) !== p.toString.call(p.toString) ||
            pageToString.call(Math.max) !== p.toString.call(Math.max);
    } catch (err) {
        return true;
    }
}
