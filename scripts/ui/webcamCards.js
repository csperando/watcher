import { $, setBadge, renderCard } from "./dom.js";
import { checkPermissionState } from "../detectors/permissions.js";
import { detectInventory } from "../detectors/webcam/inventory.js";
import { detectApiIntegrity } from "../detectors/webcam/apiIntegrity.js";
import { detectCameraLabels } from "../detectors/webcam/labelHints.js";
import { detectHardwareShape } from "../detectors/webcam/hardwareShape.js";
import { detectConsistency } from "../detectors/webcam/consistency.js";
import { analyzeMonitor } from "../detectors/webcam/monitor.js";
import { detectVmSignal } from "../detectors/vmSignal.js";

export function setCardPending(badgeId, outId, label, text) {
    setBadge($(badgeId), "unknown", label);
    $(outId).textContent = text;
}

// ---------- 1. Permissions API (camera) ----------
export async function renderCameraPermissionCard(onChange) {
    const { status, result } = await checkPermissionState("camera");
    renderCard("badge-perm", "out-perm", result);
    if (status) {
        status.onchange = () => {
            renderCameraPermissionCard(onChange);
            onChange();
        };
    }
    return result;
}

// ---------- 2. Device inventory ----------
export function renderInventoryCard(devices) {
    return renderCard("badge-inventory", "out-inventory", detectInventory(devices));
}

// ---------- 3. Camera API integrity ----------
export async function renderApiIntegrityCard(context) {
    return renderCard("badge-api", "out-api", await detectApiIntegrity(context));
}

// ---------- 4. Label hints ----------
export function renderLabelCard(devices, track) {
    return renderCard("badge-labels", "out-labels", detectCameraLabels(devices, track));
}

// ---------- 5. Hardware shape ----------
export function renderHardwareCard(track, devices) {
    return renderCard("badge-hardware", "out-hardware", detectHardwareShape(track, devices));
}

// ---------- 6. Control response ----------
export function renderControlCard(result) {
    return renderCard("badge-control", "out-control", result);
}

// ---------- 7. Frame timing ----------
export function renderTimingCard(result) {
    return renderCard("badge-timing", "out-timing", result);
}

// ---------- 8. Pixel noise ----------
export function renderNoiseCard(result) {
    return renderCard("badge-noise", "out-noise", result);
}

// ---------- 9. Flash challenge ----------
export function renderFlashCard(result) {
    return renderCard("badge-flash", "out-flash", result);
}

// ---------- 10. Consistency ----------
export function renderConsistencyCard(inputs) {
    return renderCard("badge-consistency", "out-consistency", detectConsistency(inputs));
}

// ---------- 11. Session monitor ----------
export function renderMonitorCard(monitor) {
    return renderCard("badge-monitor", "out-monitor", analyzeMonitor(monitor.events, monitor.elapsedSeconds(), monitor.stats()));
}

// ---------- 12. VM / virtualization context signal ----------
export function renderVmCard() {
    return renderCard("badge-vm", "out-vm", detectVmSignal());
}
