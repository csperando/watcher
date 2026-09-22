// ---------- 11. Session monitor: replay / freeze tracker ----------
// Watches every frame for the whole session using a tiny per-frame hash, so
// it can catch loops far longer than the 5-second sample the pixel-noise
// card sees (up to HISTORY_MS), and freezes that start mid-session.
//
// A replayed video frame hashes identically to its first showing; a real
// sensor's frames never do, because per-pixel noise changes every rounded
// block value. A still real scene can't produce a false "loop" either: a
// repeat only counts if the feed has *moved* (changed epoch, see below) at
// least twice since the first showing.
// Pure — frames are passed in as small grayscale arrays — so it can be
// tested in Node.
const HISTORY_MS = 10 * 60 * 1000;
// The scene "moved" when its mean absolute difference from the last anchor
// frame exceeds this many gray levels.
const EPOCH_STEP = 3;
const FREEZE_MS = 3000;
const TOO_DARK = 8;
// Don't report the same kind of event more often than this.
const EVENT_COOLDOWN_MS = 10000;

// Two FNV-1a variants combined into a ~53-bit key, so hash collisions over
// ~18,000 frames (10 minutes at 30 fps) stay negligible.
function hashKey(bytes) {
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (let i = 0; i < bytes.length; i++) {
        h1 = Math.imul(h1 ^ bytes[i], 0x01000193) >>> 0;
        h2 = Math.imul(h2 ^ bytes[i], 0x5bd1e995) >>> 0;
    }
    return h1 * 0x200000 + (h2 & 0x1fffff);
}

function meanAbsDiff(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
    return sum / a.length;
}

export function createReplayTracker() {
    const seen = new Map(); // key -> { t, epoch }
    let anchor = null;
    let epoch = 0;
    let lastKey = null;
    let sameSince = null;
    let frozenReported = false;
    const lastEventAt = {};
    let frames = 0;

    const emit = (type, t, detail) => {
        if (lastEventAt[type] !== undefined && t - lastEventAt[type] < EVENT_COOLDOWN_MS) return null;
        lastEventAt[type] = t;
        return { type, t, strength: "strong", detail };
    };

    function prune(t) {
        for (const [key, entry] of seen) {
            if (t - entry.t <= HISTORY_MS) break; // Map keeps insertion order
            seen.delete(key);
        }
    }

    // `gray` is one frame's small grayscale thumbnail (e.g. 16×12, 0-255).
    // Returns an event or null.
    function push(t, gray) {
        frames++;
        let brightness = 0;
        for (let i = 0; i < gray.length; i++) brightness += gray[i];
        if (brightness / gray.length < TOO_DARK) {
            sameSince = null;
            return null;
        }

        if (!anchor || meanAbsDiff(anchor, gray) > EPOCH_STEP) {
            anchor = Uint8Array.from(gray);
            epoch++;
        }

        const key = hashKey(gray);
        let event = null;

        // Freeze: the very same frame for FREEZE_MS.
        if (key === lastKey) {
            if (sameSince === null) sameSince = t;
            if (!frozenReported && t - sameSince >= FREEZE_MS) {
                frozenReported = true;
                event = emit("freeze", t, `identical frames for ${Math.round((t - sameSince) / 1000)} s`);
            }
        } else {
            sameSince = null;
            frozenReported = false;
            const earlier = seen.get(key);
            if (earlier && epoch - earlier.epoch >= 2) {
                event = emit("loop", t, `exact repeat of a frame from ${Math.round((t - earlier.t) / 100) / 10} s earlier`);
            }
            if (!earlier) seen.set(key, { t, epoch });
        }
        lastKey = key;
        prune(t);
        return event;
    }

    return { push, stats: () => ({ frames, distinctFrames: seen.size, epochs: epoch }) };
}
