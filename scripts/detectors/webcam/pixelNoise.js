// ---------- 8. Pixel noise / frozen / looped feed ----------
// A physical sensor never produces two bit-identical frames: even a static
// scene carries shot noise. A still image fed through a virtual camera does,
// a looped video eventually replays a frame it has already shown, and noise
// added on top of a still image doesn't behave like sensor noise.
// Pure functions only (no DOM), so this can be tested in Node.
import { fingerprint, fingerprintDistance, median } from "./fingerprint.js";

// Mean absolute pixel difference (0-255 grayscale) below this = "same image".
const IDENTICAL_MAD = 0.05;
// Mean brightness below this means the lens is covered or the room is dark;
// black frames are identical for a real camera too, so don't judge them.
const TOO_DARK = 8;
// Replay: two frames closer than this fraction of the sensor-noise distance.
// Two genuinely separate exposures can't get that close — their noise is
// independent — but a replayed frame can.
const REPLAY_FRACTION = 0.3;
// ...and some frame in between must differ from it by at least this many
// noise-distances, so a run of duplicated frames (A A A) isn't mistaken for
// a loop (A B A).
const MOVED_AWAY = 1;
// Noise-profile flatness: max/min ratio of per-brightness noise below this
// reads as synthetic (added uniformly) noise.
const FLAT_RATIO = 1.3;

function meanAbsDiff(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
    return sum / a.length;
}

function meanBrightness(gray) {
    let sum = 0;
    for (let i = 0; i < gray.length; i++) sum += gray[i];
    return sum / gray.length;
}

function percentile(values, p) {
    if (!values.length) return 0;
    const sorted = Float32Array.from(values).sort();
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

// Loop detection over fingerprints: frame j replays frame i if they're far
// closer than sensor noise allows, after the feed went somewhere else in
// between. `awayMax` tracks the farthest the feed got from frame j between
// i and j, so the whole search stays O(n²).
export function findReplays(samples, width, height) {
    const fps = samples.map((s) => fingerprint(s.gray, width, height));
    const consecutive = [];
    for (let i = 1; i < fps.length; i++) consecutive.push(fingerprintDistance(fps[i - 1], fps[i]));
    const moving = consecutive.filter((d) => d > 0);
    const noiseFloor = percentile(moving, 0.1);
    if (!noiseFloor) return { noiseFloor: 0, replays: [] };

    const replays = [];
    for (let j = 2; j < fps.length; j++) {
        let awayMax = fingerprintDistance(fps[j], fps[j - 1]);
        for (let i = j - 2; i >= 0; i--) {
            const d = fingerprintDistance(fps[i], fps[j]);
            if (d < REPLAY_FRACTION * noiseFloor && awayMax > MOVED_AWAY * noiseFloor) {
                replays.push((samples[j].now - samples[i].now) / 1000);
                break;
            }
            awayMax = Math.max(awayMax, d);
        }
    }
    return { noiseFloor, replays };
}

// Per-pixel temporal noise, grouped by brightness. After the camera's gamma
// curve, real sensor noise is strongly brightness-dependent (shadows are
// noisiest). Noise added uniformly to a clean image is flat. Returns null
// when the scene is too uniform or too still to judge.
export function noiseProfile(frames) {
    const use = frames.slice(0, 30);
    if (use.length < 10) return null;
    const n = use.length, px = use[0].length;
    const means = new Float32Array(px), variances = new Float32Array(px);
    for (let p = 0; p < px; p++) {
        let sum = 0;
        for (let f = 0; f < n; f++) sum += use[f][p];
        const mean = sum / n;
        let sq = 0;
        for (let f = 0; f < n; f++) sq += (use[f][p] - mean) ** 2;
        means[p] = mean;
        variances[p] = sq / n;
    }

    // Moving pixels would swamp the noise, so drop the top 10%. Bins stop
    // short of pure black and white, where clipping flattens any noise.
    const cutoff = percentile(variances, 0.9);
    const bins = Array.from({ length: 8 }, () => []);
    for (let p = 0; p < px; p++) {
        if (variances[p] > cutoff) continue;
        const b = Math.floor((means[p] - 25) / 25);
        if (b >= 0 && b < 8) bins[b].push(variances[p]);
    }
    const populated = bins
        .map((values, b) => ({ brightness: 37 + b * 25, variance: values.length >= 50 ? median(values) : null }))
        .filter((bin) => bin.variance !== null);
    if (populated.length < 3) return null;

    const vs = populated.map((bin) => bin.variance);
    const minV = Math.min(...vs), maxV = Math.max(...vs);
    if (maxV < 0.05) return null;
    return {
        bins: populated.map((bin) => ({ brightness: bin.brightness, variance: Math.round(bin.variance * 100) / 100 })),
        ratio: minV > 0 ? maxV / minV : Infinity,
        // Most pixels of a whole brightness band perfectly constant for ~1 s
        // while other bands move: synthetic content (e.g. a flat drawn
        // background). A sensor puts noise everywhere.
        noiseFreeBand: minV === 0
    };
}

export function analyzePixelNoise(samples, width = 160, height = 120) {
    if (!samples) {
        return {
            state: "unknown",
            label: "unsupported",
            text: "requestVideoFrameCallback isn't available in this browser, so individual frames can't be compared.",
            data: { flag: null }
        };
    }
    if (samples.length < 10) {
        return {
            state: "warn",
            label: "stalled",
            text: `Only ${samples.length} frame(s) arrived during sampling, which isn't enough to analyze.`,
            data: { flag: "weak" }
        };
    }

    const brightness = meanBrightness(samples[samples.length - 1].gray);
    if (brightness < TOO_DARK) {
        return {
            state: "unknown",
            label: "too dark",
            text: "Frames are almost black. Uncover the lens or turn on a light, then re-run.",
            data: { flag: null }
        };
    }

    const frames = samples.map((s) => s.gray);
    const consecutive = [];
    for (let i = 1; i < frames.length; i++) consecutive.push(meanAbsDiff(frames[i - 1], frames[i]));
    const identicalRatio = consecutive.filter((d) => d < IDENTICAL_MAD).length / consecutive.length;
    const { noiseFloor, replays } = findReplays(samples, width, height);
    const profile = identicalRatio > 0.9 ? null : noiseProfile(frames);
    const flatNoise = !!profile && profile.ratio < FLAT_RATIO;
    const noiseFree = !!profile && profile.noiseFreeBand;

    let state, label, flag, note;
    if (identicalRatio > 0.9) {
        state = "no";
        label = "frozen feed";
        flag = "strong";
        note = "Almost every frame is bit-identical to the previous one. That's a still image, not a sensor, because a real sensor always adds noise.";
    } else if (replays.length > 0) {
        state = "no";
        label = "looped feed";
        flag = "strong";
        note = "The feed returned to an earlier frame far more exactly than sensor noise allows, after changing in between. That points to a replayed video.";
    } else if (identicalRatio > 0.3) {
        state = "warn";
        label = "duplicate frames";
        flag = "weak";
        note = "Many frames repeat exactly. The source is re-sending frames at a lower rate than it claims, which is common for virtual cameras.";
    } else if (noiseFree) {
        state = "warn";
        label = "noise-free areas";
        flag = "weak";
        note = "Part of the picture has no noise at all from frame to frame. A sensor adds noise everywhere, so those areas look drawn, not filmed. Very aggressive in-camera denoising can also do this.";
    } else if (flatNoise) {
        state = "warn";
        label = "flat noise";
        flag = "weak";
        note = "The noise is the same at every brightness. Real sensor noise varies with brightness (shadows are noisiest), so this looks like noise added to a clean image. Heavy in-camera denoising can also flatten it.";
    } else {
        state = "yes";
        label = "sensor noise";
        flag = null;
        note = "Every frame differs from the last, and the noise varies with brightness like a real sensor's.";
    }

    const r3 = (n) => Math.round(n * 1000) / 1000;
    return {
        state,
        label,
        text: JSON.stringify(
            {
                framesCompared: frames.length,
                identicalConsecutiveRatio: r3(identicalRatio),
                medianFrameDiff: r3(median(consecutive)),
                fingerprintNoiseFloor: r3(noiseFloor),
                replays: replays.length,
                replayAfterSeconds: replays.slice(0, 5).map((s) => Math.round(s * 100) / 100),
                noiseProfile: profile
                    ? { ratio: Number.isFinite(profile.ratio) ? Math.round(profile.ratio * 100) / 100 : "∞", noiseFreeBand: profile.noiseFreeBand, bins: profile.bins }
                    : "not enough uniform, still area to judge",
                meanBrightness: Math.round(brightness),
                verdict: note
            },
            null, 2
        ),
        data: { flag, identicalRatio, replays: replays.length, profileRatio: profile ? profile.ratio : null }
    };
}
