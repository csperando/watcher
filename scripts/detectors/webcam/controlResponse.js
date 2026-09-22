// ---------- 6. Control response ----------
// Card 5 reads what the camera *claims* it can do. This checks the claim:
// drive a brightness/exposure control to its minimum and maximum and
// measure whether the picture actually gets darker and brighter. A real
// sensor physically responds; a virtual camera (or a script faking
// getCapabilities) can advertise a control but nothing happens to the frames.
import { trackCapabilities, trackSettings, applyTrackConstraints, createFrameGrabber, meanLuma } from "./stream.js";
import { analyzeControlResponse } from "./controlResponseAnalysis.js";

const CONTROLS = ["brightness", "exposureCompensation", "exposureTime"];
const SETTLE_MS = 600;
const GRABS = 5;
const GRAB_INTERVAL_MS = 60;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function constraintFor(control, value) {
    return control === "exposureTime" ? { exposureMode: "manual", exposureTime: value } : { [control]: value };
}

export async function runControlResponse(track, video) {
    const caps = trackCapabilities(track) || {};
    const control = CONTROLS.find((c) => caps[c] && typeof caps[c].min === "number" && caps[c].max > caps[c].min);
    if (!control) return analyzeControlResponse({ control: null });

    const grab = createFrameGrabber(64, 48);
    const measure = async () => {
        await sleep(SETTLE_MS);
        let sum = 0;
        for (let i = 0; i < GRABS; i++) {
            sum += meanLuma(grab(video));
            await sleep(GRAB_INTERVAL_MS);
        }
        return sum / GRABS;
    };
    // `advanced` constraints are silently skipped when unsatisfiable rather
    // than rejected, so read the setting back to see if it was accepted.
    const applyAndRead = async (value) => {
        await applyTrackConstraints(track, { advanced: [constraintFor(control, value)] });
        return trackSettings(track)[control];
    };

    const original = trackSettings(track);
    const range = { min: caps[control].min, max: caps[control].max };
    const result = { control, range, baseline: null, low: null, high: null, readBack: {}, error: null };
    try {
        result.baseline = await measure();
        result.readBack.low = await applyAndRead(range.min);
        result.low = await measure();
        result.readBack.high = await applyAndRead(range.max);
        result.high = await measure();
    } catch (err) {
        result.error = err.name + ": " + err.message;
    } finally {
        const restore = { [control]: original[control] };
        if (control === "exposureTime") restore.exposureMode = original.exposureMode;
        if (original[control] !== undefined) {
            await applyTrackConstraints(track, { advanced: [restore] }).catch(() => {});
        }
    }
    return analyzeControlResponse(result);
}
