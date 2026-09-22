// ---------- 10. Cross-signal consistency ----------
// The same idea as monitor method 6's cross-check: independent readings of
// the same camera should agree. A faked stream or a spoofed API tends to get
// one of them wrong. Pure function — callers pass in what they measured.
// Measured fps may fall *below* the reported rate (a real camera slows in dim
// light) but a device can't deliver more frames than it claims.
const FPS_OVERSHOOT = 1.2;

export function detectConsistency({ settings, pageSettings, videoWidth, videoHeight, label, devices, measuredFps }) {
    if (!settings) {
        return {
            state: "unknown",
            label: "not started",
            text: "(needs camera)",
            data: { flag: null }
        };
    }

    const device = (devices || []).find((d) => d.kind === "videoinput" && d.deviceId === settings.deviceId) || null;
    const checks = [];
    const check = (name, ok, detail) => checks.push({ name, ok, detail });

    if (videoWidth && videoHeight && settings.width && settings.height) {
        const matches = (settings.width === videoWidth && settings.height === videoHeight) ||
            (settings.width === videoHeight && settings.height === videoWidth); // rotated camera
        check("resolution", matches, `settings ${settings.width}×${settings.height} vs frames ${videoWidth}×${videoHeight}`);
    }
    if (measuredFps && settings.frameRate) {
        check("frame rate", measuredFps <= settings.frameRate * FPS_OVERSHOOT,
            `settings ${Math.round(settings.frameRate)} fps vs measured ${Math.round(measuredFps)} fps`);
    }
    if (device && device.label && label) {
        check("label", device.label === label, `track "${label}" vs device list "${device.label}"`);
    }
    if (device && device.groupId && settings.groupId) {
        check("groupId", device.groupId === settings.groupId, "track groupId vs device list groupId");
    }
    // What the rest of the page sees through this page's getSettings vs the
    // pristine copy. A spoofed getSettings that lies about the device shows
    // up here even if its toString was dressed up to look native.
    if (pageSettings) {
        const keys = ["deviceId", "width", "height", "frameRate"];
        const same = keys.every((k) => pageSettings[k] === settings[k]);
        check("getSettings (page vs pristine)", same, same ? "identical" : "the page's getSettings reports different values");
    }

    const mismatches = checks.filter((c) => !c.ok);
    let state, labelText, flag, note;
    if (!checks.length) {
        state = "unknown";
        labelText = "nothing to compare";
        flag = null;
        note = "Not enough information yet to cross-check.";
    } else if (mismatches.length >= 2) {
        state = "no";
        labelText = `${mismatches.length} mismatches`;
        flag = "strong";
        note = "Several independent readings of the camera disagree — typical of a faked stream or spoofed APIs.";
    } else if (mismatches.length === 1) {
        state = "warn";
        labelText = "1 mismatch";
        flag = "weak";
        note = `The ${mismatches[0].name} reading disagrees. Could be a driver quirk, could be spoofing.`;
    } else {
        state = "yes";
        labelText = "consistent";
        flag = null;
        note = "Every independent reading of the camera agrees.";
    }

    return {
        state,
        label: labelText,
        text: JSON.stringify({ checks, verdict: note }, null, 2),
        data: { flag, mismatches: mismatches.map((c) => c.name) }
    };
}
