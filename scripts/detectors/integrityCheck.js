// ---------- 6. Tamper / spoof detection for isExtended ----------
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

    // A native, un-tampered getter stringifies to "[native code]". An
    // extension or script that overrides the property to fake a value
    // will show its actual function source instead.
    const descriptor =
        Object.getOwnPropertyDescriptor(Screen.prototype, "isExtended") ||
        Object.getOwnPropertyDescriptor(screen, "isExtended");
    const getterSrc = descriptor && descriptor.get ? descriptor.get.toString() : null;
    const looksNative = !!getterSrc && getterSrc.includes("[native code]");

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
                crossCheck: { dragHeuristicDetectedMulti: dragMultiDetected, availOffsetDetected },
                verdict: note
            },
            null, 2
        ),
        data: { looksNative, inconsistent }
    };
}
