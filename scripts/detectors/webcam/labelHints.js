// ---------- 4. Camera label hints + USB ID ----------
import { trackLabel } from "./stream.js";

// Same idea as VM_HINTS in vmSignal.js: substring-match a string the user
// could change. Weak against a determined user (drivers can be renamed), but
// most virtual camera software ships with a recognizable default name.
// Deliberately "obs virtual"/"obs camera" rather than "obs", which would
// also match OBSBOT — a real PTZ webcam.
export const VIRTUAL_CAM_HINTS = [
    "obs virtual", "obs camera", "obs-camera", "virtual", "manycam", "xsplit", "vcam",
    "snap camera", "droidcam", "camo", "iriun", "epoccam", "ivcam", "nvidia broadcast",
    "mmhmm", "splitcam", "e2esoft", "youcam", "logi capture", "streamlabs", "ndi webcam", "newtek",
    "unity video capture", "chromacam", "avatarify", "fake"
];

function hintFor(label) {
    const lower = (label || "").toLowerCase();
    return VIRTUAL_CAM_HINTS.find((hint) => lower.includes(hint)) || null;
}

// On Windows and Linux, Chromium appends the USB vendor:product ID to USB
// camera labels, e.g. "Integrated Webcam (0bda:5583)". Virtual cameras
// aren't USB devices, so they never get one. Built-in MIPI cameras (e.g.
// Surface) don't either, which is why a missing ID is only a weak flag,
// and only when another camera on the same system *does* have one (proving
// this browser adds them).
const USB_ID = /\(([0-9a-f]{4}):([0-9a-f]{4})\)\s*$/i;

function usbIdOf(label) {
    const match = USB_ID.exec(label || "");
    return match ? `${match[1]}:${match[2]}`.toLowerCase() : null;
}

export function detectCameraLabels(devices, track) {
    const cameraLabels = (devices || []).filter((d) => d.kind === "videoinput").map((d) => d.label).filter(Boolean);
    const activeLabel = track ? trackLabel(track) : "";

    if (!activeLabel && cameraLabels.length === 0) {
        return {
            state: "unknown",
            label: "no labels",
            text: "No camera labels are visible yet — they're only exposed after camera permission is granted.",
            data: { flag: null }
        };
    }

    const activeHint = hintFor(activeLabel);
    const others = cameraLabels.filter((label) => label !== activeLabel);
    const installed = others
        .map((label) => ({ label, hint: hintFor(label) }))
        .filter((m) => m.hint);

    const activeUsbId = usbIdOf(activeLabel);
    const browserAddsUsbIds = cameraLabels.some((label) => usbIdOf(label));
    const usb = {
        activeUsbId,
        otherCamerasWithUsbId: others.filter((label) => usbIdOf(label)).length,
        verdict: activeUsbId
            ? "Active camera carries a USB vendor:product ID, like a physical USB device."
            : browserAddsUsbIds
                ? "Another camera here has a USB ID but the active one doesn't — not a USB device."
                : "No camera here has a USB ID, so this browser/OS probably doesn't add them. Can't judge."
    };

    let state, label, flag, note;
    if (activeHint) {
        state = "no";
        label = "virtual cam in use";
        flag = "strong";
        note = "The camera this page is actually receiving has a known virtual-camera name.";
    } else if (!activeUsbId && browserAddsUsbIds) {
        state = "warn";
        label = "no USB id";
        flag = "weak";
        note = "The active camera has no USB ID while another camera does. It may be virtual (or a built-in MIPI camera).";
    } else if (installed.length) {
        state = "warn";
        label = "virtual cam installed";
        flag = null;
        note = "A virtual camera is installed but not the one in use. Worth knowing, but not evidence about the active feed.";
    } else {
        state = "yes";
        label = activeUsbId ? "usb id present" : "no known names";
        flag = null;
        note = "No known virtual-camera names. Not proof — a renamed driver would pass this.";
    }

    return {
        state,
        label,
        text: JSON.stringify({ activeCamera: activeLabel || null, activeMatchedHint: activeHint, otherVirtualCameras: installed, usb, verdict: note }, null, 2),
        data: { flag, activeHint, installed, activeUsbId }
    };
}
