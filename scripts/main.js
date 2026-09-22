import { renderHero } from "./ui/hero.js";
import { renderRawDiagnostics } from "./ui/raw.js";
import {
    renderIsExtendedCard,
    initScreenDetailsCard,
    renderPermissionsCard,
    renderAvailCard,
    renderDragCard,
    renderIntegrityCard,
    renderRefreshCard,
    renderVmCard
} from "./ui/cards.js";
import { detectIsExtended } from "./detectors/isExtended.js";
import { wasDragMultiDetected } from "./detectors/signals.js";

function updateAll() {
    const isExtendedResult = detectIsExtended();
    renderHero(isExtendedResult);
    renderIsExtendedCard(isExtendedResult);

    const availResult = renderAvailCard();
    renderDragCard();
    renderIntegrityCard({
        availOffsetDetected: availResult.data.offsetDetected,
        dragMultiDetected: wasDragMultiDetected()
    });

    renderRawDiagnostics();
}

initScreenDetailsCard();

updateAll();
renderPermissionsCard();
renderRefreshCard();
renderVmCard();

window.addEventListener("resize", () => {
    updateAll();
    renderRefreshCard();
});

// No native "window move" event exists, so poll for position changes
// (e.g. dragging across monitors) at a light interval.
setInterval(renderDragCard, 500);
// Refresh-rate measurement is heavier, so it runs on its own slower cadence.
setInterval(renderRefreshCard, 4000);

// React live if the OS display topology changes while the page is open
// (monitor plugged/unplugged) where supported.
if ("isExtended" in screen && screen.addEventListener) {
    screen.addEventListener("change", updateAll);
}
