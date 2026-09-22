// ---------- 7. Hardware refresh-rate (vsync) timing ----------
let lastHz = null;
let measuringRefresh = false;

export function isMeasuringRefresh() {
    return measuringRefresh;
}

export function measureRefreshRate(durationMs = 500) {
    return new Promise((resolve) => {
        let frames = 0;
        let start = null;
        function step(ts) {
            if (start === null) start = ts;
            frames++;
            if (ts - start < durationMs) {
                requestAnimationFrame(step);
            } else {
                resolve((frames / (ts - start)) * 1000);
            }
        }
        requestAnimationFrame(step);
    });
}

export async function detectRefreshRate() {
    if (measuringRefresh) return null;
    measuringRefresh = true;

    const hz = await measureRefreshRate();
    const changed = lastHz !== null && Math.abs(hz - lastHz) > 5;

    const result = {
        state: changed ? "yes" : "unknown",
        label: changed ? "rate changed" : `~${Math.round(hz)} Hz`,
        text: JSON.stringify(
            {
                measuredHz: Math.round(hz * 10) / 10,
                previousHz: lastHz !== null ? Math.round(lastHz * 10) / 10 : null,
                changedSinceLastCheck: changed,
                note: changed
                    ? "Refresh rate shifted — likely moved to a physical display with a different Hz."
                    : "Baseline captured. Re-measures periodically and after resize.",
                caveat: "Noisy: OS power throttling, background-tab throttling, and CPU load can also cause shifts."
            },
            null, 2
        ),
        data: { hz, changed }
    };

    lastHz = hz;
    measuringRefresh = false;
    return result;
}
