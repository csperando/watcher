// ---------- 4. availLeft/availTop heuristic ----------
export function detectAvailHeuristic() {
    const left = screen.availLeft ?? null;
    const top = screen.availTop ?? null;
    const supported = left !== null && top !== null;

    if (!supported) {
        return {
            state: "unknown",
            label: "unsupported",
            text: "availLeft/availTop are not available in this browser.",
            data: { supported: false, left: null, top: null, offsetDetected: false }
        };
    }

    const offset = left !== 0 || top !== 0;
    return {
        state: offset ? "yes" : "warn",
        label: offset ? "offset found" : "inconclusive",
        text: JSON.stringify(
            {
                availLeft: left,
                availTop: top,
                note: offset ? "Non-zero offset suggests a display to the left/above." : "Zero offset — doesn't rule out a monitor to the right/below."
            },
            null, 2
        ),
        data: { supported: true, left, top, offsetDetected: offset }
    };
}
