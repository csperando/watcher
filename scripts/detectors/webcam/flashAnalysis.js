// ---------- 9. Flash challenge: verdict ----------
// Pure function of the samples taken by flashChallenge.js, kept separate so
// it can be tested without a camera or a screen.
const COLORS = ["red", "green", "blue"];
const STEP_MS = 500;
// Candidate capture delays: the step windows are shifted by each of these
// and the best-fitting one is kept.
const LAGS_MS = Array.from({ length: 21 }, (_, i) => i * 20);
// Typical webcam capture delay. Outside this, the feed is suspiciously
// instant (a synthetic feed reacting to the page) or late (relayed or
// processed before it reaches the browser).
const PLAUSIBLE_LAG = { min: 40, max: 350 };
const SHUFFLES = 2000;
const PASS = { p: 0.005, score: 0.5 };
const FAIL = { p: 0.05, score: 0.3 };
// A real face near the screen picks up more tint than the distant
// background. A global color filter tints both equally.
const MIN_CENTER_RATIO = 1.1;

function pearson(xs, ys) {
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) {
        num += (xs[i] - mx) * (ys[i] - my);
        dx += (xs[i] - mx) ** 2;
        dy += (ys[i] - my) ** 2;
    }
    return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

// Per step: mean chromaticity (each channel's share of r+g+b) of one region,
// so a change in overall brightness or auto-exposure doesn't swamp the tint.
// Null if any step window caught no samples.
function chromaAt(stepStarts, samples, region, lag) {
    const chroma = stepStarts.map((start) => {
        const inStep = samples.filter((s) => s.t >= start + lag && s.t < start + lag + STEP_MS);
        if (!inStep.length) return null;
        const mean = [0, 1, 2].map((c) => inStep.reduce((a, s) => a + s[region][c], 0) / inStep.length);
        const total = mean[0] + mean[1] + mean[2] || 1;
        return mean.map((v) => v / total);
    });
    return chroma.some((c) => c === null) ? null : chroma;
}

function score(sequence, chroma) {
    const perChannel = COLORS.map((color, c) =>
        pearson(sequence.map((s) => (s === color ? 1 : 0)), chroma.map((rgb) => rgb[c]))
    );
    return { perChannel, mean: perChannel.reduce((a, b) => a + b, 0) / perChannel.length };
}

// How much a region's color moves toward the flashed color, averaged over
// channels: mean share of channel c while c is shown, minus while it isn't.
function tintAmplitude(sequence, chroma) {
    const amps = COLORS.map((color, c) => {
        const on = chroma.filter((_, k) => sequence[k] === color).map((rgb) => rgb[c]);
        const off = chroma.filter((_, k) => sequence[k] !== color).map((rgb) => rgb[c]);
        const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
        return avg(on) - avg(off);
    });
    return amps.reduce((a, b) => a + b, 0) / amps.length;
}

function shuffled(array) {
    const a = [...array];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export function analyzeFlash(sequence, stepStarts, samples) {
    const byLag = LAGS_MS
        .map((lag) => ({ lag, chroma: chromaAt(stepStarts, samples, "center", lag) }))
        .filter((entry) => entry.chroma);

    if (!byLag.length) {
        return {
            state: "unknown",
            label: "no frames",
            text: "The camera delivered no frames during at least one color step, so there's nothing to correlate. Try again.",
            data: { flag: null, score: null }
        };
    }

    // Best-fitting delay. The shuffles below also take their best delay, so
    // the p-value accounts for having picked the best of several.
    const bestFor = (seq) => byLag.reduce((best, entry) => {
        const s = score(seq, entry.chroma).mean;
        return s > best.score ? { score: s, lag: entry.lag, chroma: entry.chroma } : best;
    }, { score: -Infinity, lag: null, chroma: null });

    const best = bestFor(sequence);
    let atLeastAsGood = 0;
    for (let i = 0; i < SHUFFLES; i++) {
        if (bestFor(shuffled(sequence)).score >= best.score) atLeastAsGood++;
    }
    const p = (atLeastAsGood + 1) / (SHUFFLES + 1);
    const { perChannel } = score(sequence, best.chroma);

    const borderChroma = chromaAt(stepStarts, samples, "border", best.lag);
    const centerAmp = tintAmplitude(sequence, best.chroma);
    const borderAmp = borderChroma ? tintAmplitude(sequence, borderChroma) : null;
    const centerRatio = borderAmp !== null && borderAmp > 0 ? centerAmp / borderAmp : null;

    const passed = p < PASS.p && best.score >= PASS.score;
    const failed = p >= FAIL.p || best.score < FAIL.score;
    const concerns = [];
    if (passed && (best.lag < PLAUSIBLE_LAG.min || best.lag > PLAUSIBLE_LAG.max)) {
        concerns.push(`capture delay ${best.lag} ms is outside the usual ${PLAUSIBLE_LAG.min}-${PLAUSIBLE_LAG.max} ms for a webcam`);
    }
    if (passed && centerRatio !== null && centerRatio < MIN_CENTER_RATIO) {
        concerns.push("the background tinted as much as the center, like a whole-frame color filter rather than light on a face");
    }

    let state, label, flag, note;
    if (passed && !concerns.length) {
        state = "yes";
        label = "reacted";
        flag = null;
        note = "The feed's color followed the random flash sequence, so the camera is seeing this screen's light live.";
    } else if (passed) {
        state = "warn";
        label = "reacted, but…";
        flag = "weak";
        note = "The feed followed the sequence, but " + concerns.join("; and ") + ".";
    } else if (failed) {
        state = "no";
        label = "no reaction";
        flag = "strong";
        note = "The feed's color didn't follow the flash sequence. It's pre-recorded or synthetic, or the camera isn't facing the screen.";
    } else {
        state = "warn";
        label = "weak reaction";
        flag = "weak";
        note = "Only a weak correlation. Bright ambient light or a far-away face dilutes the reflection. Move closer, dim the room and retry.";
    }

    const r2 = (n) => (n === null ? null : Math.round(n * 100) / 100);
    return {
        state,
        label,
        text: JSON.stringify(
            {
                sequence,
                correlation: { red: r2(perChannel[0]), green: r2(perChannel[1]), blue: r2(perChannel[2]), mean: r2(best.score) },
                pValue: Math.round(p * 10000) / 10000,
                captureDelayMs: best.lag,
                centerVsBackgroundTint: r2(centerRatio),
                samples: samples.length,
                verdict: note
            },
            null, 2
        ),
        data: { flag, score: best.score, p, lag: best.lag, centerRatio }
    };
}
