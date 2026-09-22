// ---------- 11. Session monitor ----------
// Everything else on this page checks the camera once. A virtual camera can
// pass those checks live and then switch to a recording, so this keeps
// watching for the rest of the session:
//   - every frame goes through replayTracker.js (loops and freezes);
//   - track mute/unmute/ended events are logged;
//   - the camera's settings are polled for a switched device or format;
//   - a feed that stops delivering frames is logged as a stall.
import { createReplayTracker } from "./replayTracker.js";
import { createFrameGrabber, onNextFrame, toGray, trackSettings, trackLabel } from "./stream.js";

const THUMB_W = 16;
const THUMB_H = 12;
const SETTINGS_POLL_MS = 2000;
const STALL_MS = 2000;
const WATCHED_SETTINGS = ["deviceId", "width", "height", "frameRate"];

// `isPaused` returns true while frames are expected to stop for innocent
// reasons (e.g. the flash overlay covering the preview); the tab being
// hidden is checked here too, since browsers stop frame callbacks then.
export function startMonitor({ video, track, onEvent, isPaused = () => false }) {
    const tracker = createReplayTracker();
    const grab = createFrameGrabber(THUMB_W, THUMB_H);
    const events = [];
    const t0 = performance.now();
    let running = true;
    let lastFrameAt = performance.now();
    let stalled = false;

    const log = (type, strength, detail) => {
        const event = { type, strength, detail, at: Math.round((performance.now() - t0) / 1000) };
        events.push(event);
        onEvent(event);
    };

    function onFrame(now) {
        if (!running) return;
        lastFrameAt = performance.now();
        stalled = false;
        const event = tracker.push(now, toGray(grab(video)));
        if (event) log(event.type, event.strength, event.detail);
        onNextFrame(video, onFrame);
    }
    onNextFrame(video, onFrame);

    const snapshot = () => {
        const s = trackSettings(track);
        return { ...Object.fromEntries(WATCHED_SETTINGS.map((k) => [k, s[k]])), label: trackLabel(track) };
    };
    let previous = snapshot();
    const poll = setInterval(() => {
        if (track.readyState === "ended") return;
        const current = snapshot();
        const changed = Object.keys(current).filter((k) => current[k] !== previous[k]);
        if (changed.length) {
            log("source change", "weak", changed.map((k) => `${k}: ${previous[k]} → ${current[k]}`).join(", "));
            previous = current;
        }
        if (document.hidden || isPaused()) {
            lastFrameAt = performance.now();
        } else if (!stalled && performance.now() - lastFrameAt > STALL_MS) {
            stalled = true;
            log("stall", "weak", `no new frame for over ${STALL_MS / 1000} s`);
        }
    }, SETTINGS_POLL_MS);

    const onMute = () => log("mute", "weak", "the source stopped providing frames (track muted)");
    const onUnmute = () => log("unmute", null, "frames resumed");
    const onEnded = () => log("ended", "weak", "the camera track ended");
    track.addEventListener("mute", onMute);
    track.addEventListener("unmute", onUnmute);
    track.addEventListener("ended", onEnded);

    return {
        events,
        log,
        elapsedSeconds: () => Math.round((performance.now() - t0) / 1000),
        stats: () => tracker.stats(),
        stop() {
            running = false;
            clearInterval(poll);
            track.removeEventListener("mute", onMute);
            track.removeEventListener("unmute", onUnmute);
            track.removeEventListener("ended", onEnded);
        }
    };
}

// Card verdict from the event log. Pure.
export function analyzeMonitor(events, elapsedSeconds, stats) {
    const strong = events.filter((e) => e.strength === "strong");
    const weak = events.filter((e) => e.strength === "weak");
    let state, label, flag;
    if (strong.length) {
        state = "no";
        label = strong[strong.length - 1].type + " detected";
        flag = "strong";
    } else if (weak.length) {
        state = "warn";
        label = `${weak.length} event${weak.length === 1 ? "" : "s"}`;
        flag = "weak";
    } else {
        state = "yes";
        label = `clean for ${elapsedSeconds}s`;
        flag = null;
    }
    return {
        state,
        label,
        text: JSON.stringify(
            {
                watchingForSeconds: elapsedSeconds,
                framesHashed: stats.frames,
                timeline: events.slice(-20).map((e) => `+${e.at}s ${e.type}${e.strength ? ` [${e.strength}]` : ""}: ${e.detail}`)
            },
            null, 2
        ),
        data: { flag }
    };
}
