import { $ } from "./dom.js";

// Cards whose result can raise a red flag, with the card name shown in the
// hero's sub-line. Each detector marks its own result with
// data.flag = "strong" | "weak" | null.
const FLAG_SOURCES = {
    integrity: "3. API integrity",
    labels: "4. label/USB ID",
    hardware: "5. hardware shape",
    control: "6. control response",
    timing: "7. frame timing",
    noise: "8. pixel noise",
    consistency: "10. consistency",
    monitor: "11. session monitor"
};

function setHero(verdict, state, sub, flagCount) {
    $("hero-verdict").textContent = verdict;
    $("hero-verdict").className = "hero-verdict " + state;
    $("hero-sub").textContent = sub;
    $("hero-count").innerHTML = flagCount === null ? "" : `${flagCount}<small>red flag${flagCount === 1 ? "" : "s"}</small>`;
}

// ---------- Hero ----------
// Precedence:
//   1. a tampered camera API (card 3) overrides everything;
//   2. a loop or freeze caught mid-session (card 11) overrides an earlier pass;
//   3. the flash challenge (card 9), the one signal a virtual camera can't
//      pre-compute, decides live vs. phony — but a live feed that other cards
//      strongly flag (e.g. a real camera relayed through OBS) is reported as such;
//   4. otherwise, a tally of the other cards.
export function renderWebcamHero(results) {
    const flags = Object.keys(FLAG_SOURCES)
        .filter((key) => results[key] && results[key].data && results[key].data.flag)
        .map((key) => ({ key, name: FLAG_SOURCES[key], strength: results[key].data.flag }));
    const strong = flags.filter((f) => f.strength === "strong");
    const weak = flags.filter((f) => f.strength === "weak");
    const list = (fs) => fs.map((f) => `${f.name} (${f.strength})`).join(", ");

    if (results.integrity && results.integrity.data.flag === "strong") {
        setHero("Camera API tampered", "no", "Source: card 3. A script is intercepting or faking the camera stream.", flags.length);
        return;
    }

    if (results.monitor && results.monitor.data.flag === "strong") {
        setHero("Phony feed mid-session", "no", `Source: card 11 (${results.monitor.label}). The feed changed behavior after the first checks.`, flags.length);
        return;
    }

    if (results.flash) {
        const { state, data } = results.flash;
        const score = data.score === null ? "n/a" : data.score.toFixed(2);
        const others = strong.filter((f) => f.key !== "monitor");
        if (state === "yes" && others.length) {
            setHero("Live feed, but flagged", "warn", `The flash test passed (correlation ${score}), yet ${list(others)} flagged it — e.g. a real camera relayed through a virtual one.`, flags.length);
            return;
        }
        const verdict = state === "yes" ? "Live camera" : state === "no" ? "Likely phony camera" : "Inconclusive";
        setHero(verdict, state, `Source: screen-flash challenge (card 9), correlation ${score}.${flags.length ? " Other flags: " + list(flags) + "." : ""}`, flags.length);
        return;
    }

    if (!results.cameraStarted) {
        setHero("Not checked yet", "unknown", "Start the camera to run the checks that need a live feed.", null);
        return;
    }

    if (strong.length || weak.length >= 2) {
        setHero("Likely phony camera", "no", `Flagged by ${list(flags)}. Run the flash test (card 9) to confirm.`, flags.length);
    } else if (weak.length === 1) {
        setHero("Suspicious", "warn", `One weak flag: ${list(flags)}. Run the flash test (card 9) to confirm.`, flags.length);
    } else {
        setHero("Looks like a real camera", "yes", "No card raised a flag. The flash test (card 9) gives the strongest confirmation.", 0);
    }
}
