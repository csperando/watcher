// ---------- 1. screen.isExtended ----------
export function detectIsExtended() {
    if (!("isExtended" in screen)) {
        return {
            state: "unknown",
            label: "unsupported",
            text: "screen.isExtended is not available in this browser.",
            data: { supported: false, value: null }
        };
    }

    const val = screen.isExtended;
    return {
        state: val ? "yes" : "no",
        label: val ? "multiple" : "single",
        text: JSON.stringify({ "screen.isExtended": val }, null, 2),
        data: { supported: true, value: val }
    };
}
