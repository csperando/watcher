// ---------- 5. Hardware shape: capabilities + groupId ----------
// Physical UVC webcams expose sensor/lens controls through
// getCapabilities(). Virtual cameras are usually just a frame source, so
// they report little beyond width/height/frameRate.
import { trackCapabilities, trackSettings } from "./stream.js";

const PHYSICAL_CONTROLS = [
    "exposureMode", "exposureTime", "exposureCompensation", "focusMode", "focusDistance",
    "whiteBalanceMode", "colorTemperature", "brightness", "contrast", "saturation",
    "sharpness", "zoom", "pan", "tilt", "iso", "torch", "backgroundBlur"
];

function range(cap) {
    return cap && typeof cap === "object" && "min" in cap ? `${cap.min}-${cap.max}` : cap ?? null;
}

export function detectHardwareShape(track, devices) {
    if (!track || typeof track.getCapabilities !== "function") {
        return {
            state: "unknown",
            label: "unsupported",
            text: "MediaStreamTrack.getCapabilities() isn't available in this browser.",
            data: { flag: null }
        };
    }

    const caps = trackCapabilities(track);
    const settings = trackSettings(track);
    const controls = PHYSICAL_CONTROLS.filter((key) => key in caps);

    // A built-in or USB webcam with a microphone reports both under the same
    // groupId (one physical device). A virtual camera almost never has a
    // matching audio input.
    const pairedMic = (devices || []).find(
        (d) => d.kind === "audioinput" && d.groupId && d.groupId === settings.groupId
    );

    // Browsers outside Chromium mostly don't expose sensor controls at all, so
    // an empty list there says nothing about the camera.
    const supported = navigator.mediaDevices.getSupportedConstraints();
    const browserExposesControls = PHYSICAL_CONTROLS.some((key) => supported[key]);

    let state, label, flag, note;
    if (controls.length > 0) {
        state = "yes";
        label = pairedMic ? "hardware + mic" : "hardware-like";
        flag = null;
        note = "The camera exposes physical sensor/lens controls, like a real UVC device.";
    } else if (!browserExposesControls) {
        state = "unknown";
        label = "browser limited";
        flag = null;
        note = "This browser doesn't expose camera controls through getCapabilities(), so their absence proves nothing.";
    } else {
        state = "warn";
        label = pairedMic ? "no controls" : "no controls, no mic";
        flag = "weak";
        note = "No physical controls exposed — typical of a virtual camera, though some cheap webcams are this bare too.";
    }

    return {
        state,
        label,
        text: JSON.stringify(
            {
                physicalControls: controls,
                resolution: { width: range(caps.width), height: range(caps.height) },
                frameRate: range(caps.frameRate),
                sharesGroupIdWithMic: pairedMic ? pairedMic.label || true : false,
                verdict: note
            },
            null, 2
        ),
        data: { flag, controls, pairedMic: !!pairedMic }
    };
}
