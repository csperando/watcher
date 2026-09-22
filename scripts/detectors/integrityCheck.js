// ---------- 6. Tamper / spoof detection for isExtended ----------
import { isNativeFunction, isToStringPatched } from "./nativeCode.js";
import { getPristine } from "./pristine.js";

// Takes its cross-signal inputs as explicit parameters (rather than reaching
// into method 4's or method 5's internals) so the dependency is visible at
// the call site — see scripts/main.js.
export function detectIntegrity({ availOffsetDetected, dragMultiDetected }) {
    if (!("isExtended" in screen)) {
        return {
            state: "unknown",
            label: "n/a",
            text: "screen.isExtended doesn't exist here at all — that's the honest " +
                "signature of an enterprise policy or unsupported browser, not spoofing.",
            data: { supported: false }
        };
    }

    // An override that fakes the value replaces the native getter. It's
    // compared against the same getter from a pristine iframe realm — see
    // nativeCode.js for why that can't be fooled by a per-function or
    // page-wide `toString`. An own property on the `screen` instance shadows
    // the prototype, so it's checked first.
    const descriptor =
        Object.getOwnPropertyDescriptor(screen, "isExtended") ||
        Object.getOwnPropertyDescriptor(Screen.prototype, "isExtended");
    const pristine = getPristine();
    const looksNative = !!descriptor && isNativeFunction(descriptor.get, pristine && pristine.screenIsExtended);
    const toStringPatched = isToStringPatched();

    // Cross-check isExtended's answer against the independent heuristics
    // gathered elsewhere on this page.
    const otherSignals = dragMultiDetected || availOffsetDetected;
    const inconsistent = screen.isExtended === false && otherSignals;

    let state, label, note;
    if (!looksNative) {
        state = "warn";
        label = "possibly overridden";
        note = "The isExtended getter is not native code — a browser extension or privacy " +
            "tool may be intercepting it. Its reported value cannot be trusted on its own.";
    } else if (toStringPatched) {
        state = "warn";
        label = "toString patched";
        note = "The getter checks out against a pristine copy, but this page's Function.prototype.toString " +
            "has been replaced (Brave's fingerprint protection does this). Something is rewriting built-ins, " +
            "so treat every native-code check here with extra caution.";
    } else if (inconsistent) {
        state = "warn";
        label = "inconsistent";
        note = "isExtended reports a single display, but another heuristic on this page " +
            "(drag bounds or availLeft/Top offset) suggests otherwise. Worth treating isExtended " +
            "as unreliable until confirmed with method 2.";
    } else {
        state = "yes";
        label = "looks trustworthy";
        note = "Getter is native code and agrees with the other independent signals gathered so far.";
    }

    return {
        state,
        label,
        text: JSON.stringify(
            {
                getterIsNativeCode: looksNative,
                pageToStringPatched: toStringPatched,
                crossCheck: { dragHeuristicDetectedMulti: dragMultiDetected, availOffsetDetected },
                verdict: note
            },
            null, 2
        ),
        data: { looksNative, inconsistent, toStringPatched }
    };
}
