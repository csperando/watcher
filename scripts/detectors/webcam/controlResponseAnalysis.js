// ---------- 6. Control response: verdict ----------
// Pure function of the measurements taken by controlResponse.js, kept
// separate so it can be tested without a camera.
// Minimum luminance swing (0-255) between a control's min and max that
// counts as the picture responding.
const MIN_RESPONSE = 10;
const TOO_DARK = 8;

const round = (n) => (typeof n === "number" ? Math.round(n * 10) / 10 : n);

export function analyzeControlResponse({ control, range = null, baseline = null, low = null, high = null, readBack = {}, error = null }) {
    if (!control) {
        return {
            state: "unknown",
            label: "no controls",
            text: "The camera advertises no adjustable brightness/exposure control, so there's nothing to drive. Card 5 covers that absence.",
            data: { flag: null, accepted: null }
        };
    }

    const accepted = readBack.low !== undefined && readBack.high !== undefined && readBack.low !== readBack.high;
    const swing = low !== null && high !== null ? high - low : null;

    let state, label, flag, note;
    if (error) {
        state = "warn";
        label = "control error";
        flag = "weak";
        note = `Setting ${control} failed even though it's advertised. Some drivers are quirky, but a faked capability fails the same way.`;
    } else if (baseline !== null && baseline < TOO_DARK) {
        state = "unknown";
        label = "too dark";
        flag = null;
        note = "The picture is almost black, so a brightness change can't be measured. Turn on a light and re-run.";
    } else if (swing !== null && swing >= MIN_RESPONSE) {
        state = "yes";
        label = "responds";
        flag = null;
        note = `Driving ${control} from min to max brightened the picture by ${round(swing)} levels — a physical sensor responding.`;
    } else if (accepted) {
        state = "no";
        label = "no response";
        flag = "strong";
        note = `The camera accepted new ${control} values but the picture didn't change. The control is advertised, not real.`;
    } else {
        state = "warn";
        label = "ignored";
        flag = "weak";
        note = `The ${control} change was silently ignored (the setting didn't change) and the picture stayed the same.`;
    }

    return {
        state,
        label,
        text: JSON.stringify(
            {
                control,
                range,
                settingReadBack: readBack,
                meanLuma: { baseline: round(baseline), atMin: round(low), atMax: round(high) },
                swing: round(swing),
                error,
                verdict: note
            },
            null, 2
        ),
        data: { flag, accepted, swing }
    };
}
