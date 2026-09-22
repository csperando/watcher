import { $, setBadge, renderCard } from "./dom.js";
import {
    isScreenDetailsSupported,
    requestScreenDetails,
    shapeScreens,
    shapeScreensLive,
    detectLabelHints
} from "../detectors/screenDetails.js";
import { checkPermissionState } from "../detectors/permissions.js";
import { detectAvailHeuristic } from "../detectors/availHeuristic.js";
import { detectDragHeuristic } from "../detectors/dragHeuristic.js";
import { detectIntegrity } from "../detectors/integrityCheck.js";
import { detectRefreshRate, isMeasuringRefresh } from "../detectors/refreshRate.js";
import { detectVmSignal } from "../detectors/vmSignal.js";

// ---------- 1. screen.isExtended ----------
export function renderIsExtendedCard(result) {
    return renderCard("badge-isExtended", "out-isExtended", result);
}

// ---------- 2. getScreenDetails() ----------
export function initScreenDetailsCard() {
    $("btn-details").addEventListener("click", async () => {
        const badge = $("badge-details");
        const out = $("out-details");
        const btn = $("btn-details");
        btn.disabled = true;

        if (!isScreenDetailsSupported()) {
            setBadge(badge, "unknown", "unsupported");
            out.textContent = "getScreenDetails() is not available in this browser.";
            btn.disabled = false;
            return;
        }

        try {
            const details = await requestScreenDetails();
            const screens = shapeScreens(details.screens);
            const multi = screens.length > 1;
            const hints = detectLabelHints(screens);
            setBadge(
                badge,
                hints.anyHint ? "warn" : (multi ? "yes" : "no"),
                hints.anyHint ? "vm label found" : (multi ? `${screens.length} screens` : "1 screen")
            );
            out.textContent = JSON.stringify({ screens, vmLabelHint: hints.anyHint ? hints.matches : null }, null, 2);

            details.addEventListener("screenschange", () => {
                const liveScreens = shapeScreensLive(details.screens);
                const liveHints = detectLabelHints(liveScreens);
                out.textContent = JSON.stringify({ screens: liveScreens, vmLabelHint: liveHints.anyHint ? liveHints.matches : null }, null, 2);
                setBadge(
                    badge,
                    liveHints.anyHint ? "warn" : (details.screens.length > 1 ? "yes" : "no"),
                    liveHints.anyHint ? "vm label found" : `${details.screens.length} screens (live)`
                );
            });
        } catch (err) {
            setBadge(badge, "warn", "denied/error");
            out.textContent = "Permission denied or error: " + err.message;
        } finally {
            btn.disabled = false;
        }
    });
}

// ---------- 3. Permissions API ----------
export async function renderPermissionsCard() {
    const { status, result } = await checkPermissionState();
    renderCard("badge-perm", "out-perm", result);
    if (status) {
        status.onchange = renderPermissionsCard;
    }
}

// ---------- 4. availLeft/availTop heuristic ----------
export function renderAvailCard() {
    return renderCard("badge-avail", "out-avail", detectAvailHeuristic());
}

// ---------- 5. Drag / position heuristic ----------
export function renderDragCard() {
    return renderCard("badge-drag", "out-drag", detectDragHeuristic());
}

// ---------- 6. Tamper / spoof detection for isExtended ----------
export function renderIntegrityCard({ availOffsetDetected, dragMultiDetected }) {
    return renderCard("badge-integrity", "out-integrity", detectIntegrity({ availOffsetDetected, dragMultiDetected }));
}

// ---------- 7. Hardware refresh-rate (vsync) timing ----------
export async function renderRefreshCard() {
    if (isMeasuringRefresh()) return;
    setBadge($("badge-refresh"), "unknown", "measuring");

    const result = await detectRefreshRate();
    if (!result) return;
    renderCard("badge-refresh", "out-refresh", result);
}

// ---------- 8. VM / virtualization context signal ----------
export function renderVmCard() {
    return renderCard("badge-vm", "out-vm", detectVmSignal());
}
