import { $ } from "./dom.js";

// ---------- Hero ----------
export function renderHero(isExtendedResult) {
    const heroVerdict = $("hero-verdict");
    const heroSub = $("hero-sub");

    if (isExtendedResult.data.supported) {
        const extended = isExtendedResult.data.value;
        heroVerdict.textContent = extended ? "Multiple displays detected" : "Single display";
        heroVerdict.className = "hero-verdict " + (extended ? "yes" : "no");
        heroSub.textContent = "Source: screen.isExtended (Window Management API, no permission needed).";
    } else {
        heroVerdict.textContent = "Unknown (unsupported browser)";
        heroVerdict.className = "hero-verdict unknown";
        heroSub.textContent = "screen.isExtended isn't supported here — see the heuristic cards below.";
    }
}
