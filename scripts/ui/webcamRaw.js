import { $ } from "./dom.js";

const shortId = (id) => (id ? id.slice(0, 8) + "…" : "");

// ---------- Raw diagnostics ----------
export function renderWebcamRaw({ devices, track }) {
    const md = navigator.mediaDevices;
    $("out-raw").textContent = JSON.stringify({
        apis: {
            "navigator.mediaDevices": !!md,
            "getUserMedia": !!(md && md.getUserMedia),
            "enumerateDevices": !!(md && md.enumerateDevices),
            "requestVideoFrameCallback": "requestVideoFrameCallback" in HTMLVideoElement.prototype,
            "MediaStreamTrack.getCapabilities": typeof MediaStreamTrack.prototype.getCapabilities === "function",
            "navigator.permissions": !!(navigator.permissions && navigator.permissions.query),
            "isSecureContext": window.isSecureContext
        },
        supportedConstraints: md && md.getSupportedConstraints ? md.getSupportedConstraints() : null,
        devices: devices
            ? devices.map((d) => ({ kind: d.kind, label: d.label, deviceId: shortId(d.deviceId), groupId: shortId(d.groupId) }))
            : null,
        track: track
            ? { label: track.label, readyState: track.readyState, muted: track.muted, settings: track.getSettings() }
            : null
    }, null, 2);
}
