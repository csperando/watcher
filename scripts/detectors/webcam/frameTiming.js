// ---------- 7. Frame timing (sensor clock) ----------
// The camera equivalent of method 7's refresh-rate timing: a physical sensor
// is clocked by real exposure, so frame intervals jitter (and fps drops in dim
// light as auto-exposure lengthens). A virtual camera is usually paced by a
// software render loop and delivers suspiciously uniform intervals.
// Coefficient of variation (stddev / mean interval) below this reads as
// software-paced. Deliberately conservative — some real drivers stamp frames
// very regularly too, so this is only ever a weak flag.
const UNIFORM_CV = 0.003;

const round = (n, places = 2) => Math.round(n * 10 ** places) / 10 ** places;

export function analyzeFrameTiming(samples, track) {
    if (!samples) {
        return {
            state: "unknown",
            label: "unsupported",
            text: "requestVideoFrameCallback isn't available in this browser, so per-frame timing can't be read.",
            data: { flag: null }
        };
    }
    if (samples.length < 10) {
        return {
            state: "warn",
            label: "stalled",
            text: `Only ${samples.length} frame(s) arrived during sampling. The source is stalled or only sends frames on change, which physical sensors don't do.`,
            data: { flag: "weak" }
        };
    }

    // Prefer captureTime (when the sensor captured the frame) and fall back
    // to mediaTime (the frame's own timestamp, in seconds).
    const useCapture = samples.every((s) => s.captureTime !== null);
    const times = samples.map((s) => (useCapture ? s.captureTime : s.mediaTime * 1000));
    const deltas = [];
    for (let i = 1; i < times.length; i++) deltas.push(times[i] - times[i - 1]);

    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const sd = Math.sqrt(deltas.reduce((a, d) => a + (d - mean) ** 2, 0) / deltas.length);
    const cv = mean > 0 ? sd / mean : 0;
    const dropped = samples[samples.length - 1].presentedFrames - samples[0].presentedFrames - (samples.length - 1);
    const uniform = cv < UNIFORM_CV;

    return {
        state: uniform ? "warn" : "yes",
        label: uniform ? "too uniform" : "natural jitter",
        text: JSON.stringify(
            {
                clock: useCapture ? "captureTime" : "mediaTime",
                frames: samples.length,
                measuredFps: mean > 0 ? round(1000 / mean, 1) : null,
                reportedFps: track ? track.getSettings().frameRate ?? null : null,
                meanIntervalMs: round(mean),
                stddevMs: round(sd),
                coefficientOfVariation: round(cv, 4),
                framesSkippedByPage: Math.max(0, dropped),
                verdict: uniform
                    ? "Frame intervals are nearly perfectly regular, which suggests a software render loop rather than a sensor clock."
                    : "Frame intervals jitter like a physical sensor. Try re-running in dim light: a real camera's fps usually drops."
            },
            null, 2
        ),
        data: { flag: uniform ? "weak" : null, cv, fps: mean > 0 ? 1000 / mean : null }
    };
}
