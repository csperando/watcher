// ---------- 9. Challenge-response: screen-flash reflection ----------
// The page lights the user's face with a random color sequence it chose a
// moment ago. A real camera pointed at a real person sees that tint (after
// a short capture delay). A pre-recorded or synthetic feed can't know the
// sequence in advance, so its color can't follow it. The verdict logic is
// in flashAnalysis.js.
import { createFrameGrabber } from "./stream.js";
import { analyzeFlash } from "./flashAnalysis.js";

const RGB = { red: "rgb(255,0,0)", green: "rgb(0,255,0)", blue: "rgb(0,0,255)" };
const COLORS = Object.keys(RGB);
// 500 ms per color = 2 changes per second, under the WCAG 2.3.1 limit of
// three flashes per second. Must match STEP_MS in flashAnalysis.js.
const STEP_MS = 500;
const STEPS = 10;
// Keep sampling after the last color so the delay search (up to 400 ms)
// has frames for the final step.
const TAIL_MS = 450;
const SAMPLE_INTERVAL_MS = 40;
const GRID = 32;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Random, no color twice in a row, and every color appears at least twice
// so each channel's correlation has something to work with.
export function randomSequence(steps = STEPS) {
    for (;;) {
        const seq = [];
        for (let i = 0; i < steps; i++) {
            const options = COLORS.filter((c) => c !== seq[i - 1]);
            seq.push(options[Math.floor(Math.random() * options.length)]);
        }
        if (COLORS.every((c) => seq.filter((s) => s === c).length >= 2)) return seq;
    }
}

// Average RGB of the frame's center (where the face usually is) and of the
// border around it (the background), from one grab. The center is the
// middle half in each direction, i.e. a quarter of the area. Uses a timer
// rather than requestVideoFrameCallback because the preview is covered by
// the overlay while this runs.
function sampleRegions(grab, video) {
    const data = grab(video);
    const center = [0, 0, 0], all = [0, 0, 0];
    let nCenter = 0;
    for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
            const i = (y * GRID + x) * 4;
            const inCenter = x >= GRID / 4 && x < (3 * GRID) / 4 && y >= GRID / 4 && y < (3 * GRID) / 4;
            for (let c = 0; c < 3; c++) {
                all[c] += data[i + c];
                if (inCenter) center[c] += data[i + c];
            }
            if (inCenter) nCenter++;
        }
    }
    const nBorder = GRID * GRID - nCenter;
    return {
        center: center.map((v) => v / nCenter),
        border: all.map((v, c) => (v - center[c]) / nBorder)
    };
}

export async function runFlashChallenge(video, overlay) {
    const grab = createFrameGrabber(GRID, GRID);
    const sequence = randomSequence();
    const stepStarts = [];
    const samples = [];
    const t0 = performance.now();

    overlay.hidden = false;
    const timer = setInterval(() => {
        samples.push({ t: performance.now() - t0, ...sampleRegions(grab, video) });
    }, SAMPLE_INTERVAL_MS);

    try {
        for (const color of sequence) {
            overlay.style.background = RGB[color];
            stepStarts.push(performance.now() - t0);
            await sleep(STEP_MS);
        }
        overlay.hidden = true;
        await sleep(TAIL_MS);
    } finally {
        clearInterval(timer);
        overlay.hidden = true;
        overlay.style.background = "";
    }

    return analyzeFlash(sequence, stepStarts, samples);
}
