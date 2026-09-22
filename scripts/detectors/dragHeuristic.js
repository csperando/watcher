import { recordDragOutOfBounds, wasDragMultiDetected } from "./signals.js";

// ---------- 5. Drag / position heuristic ----------
export function detectDragHeuristic() {
    const x = window.screenX;
    const y = window.screenY;
    const w = window.outerWidth;
    const h = window.outerHeight;
    const sw = screen.width;
    const sh = screen.height;

    const outOfBounds = x < 0 || y < 0 || (x + w) > sw || (y + h) > sh;
    if (outOfBounds) recordDragOutOfBounds();

    const everDetected = wasDragMultiDetected();

    return {
        state: everDetected ? "yes" : "warn",
        label: everDetected ? "multiple" : "watching",
        text: JSON.stringify(
            {
                screenX: x, screenY: y, outerWidth: w, outerHeight: h,
                primaryScreen: { width: sw, height: sh },
                outOfPrimaryBounds: outOfBounds,
                everDetected
            },
            null, 2
        ),
        data: { outOfBounds, everDetected }
    };
}
