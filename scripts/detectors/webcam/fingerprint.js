// ---------- Frame fingerprints ----------
// A 16×12 block-average of a grayscale frame. Small enough to keep minutes
// of history (monitor.js) and to compare every pair of frames cheaply
// (pixelNoise.js), while still telling scenes apart. Block averaging also
// smooths away per-pixel noise, so a replayed frame that went through
// slightly different scaling or compression still lands close to the
// original. Pure functions only (no DOM), so they can be tested in Node.
export const FP_WIDTH = 16;
export const FP_HEIGHT = 12;

export function fingerprint(gray, width, height) {
    const fp = new Float32Array(FP_WIDTH * FP_HEIGHT);
    const bw = width / FP_WIDTH, bh = height / FP_HEIGHT;
    for (let by = 0; by < FP_HEIGHT; by++) {
        for (let bx = 0; bx < FP_WIDTH; bx++) {
            let sum = 0, n = 0;
            for (let y = Math.floor(by * bh); y < Math.floor((by + 1) * bh); y++) {
                for (let x = Math.floor(bx * bw); x < Math.floor((bx + 1) * bw); x++) {
                    sum += gray[y * width + x];
                    n++;
                }
            }
            fp[by * FP_WIDTH + bx] = n ? sum / n : 0;
        }
    }
    return fp;
}

export function fingerprintDistance(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
    return sum / a.length;
}

export function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}
