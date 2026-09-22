// ---------- 2. Device inventory (enumerateDevices) ----------
// Takes the device list as a parameter (fetched once in webcam-main.js) so
// cards 2-5 all reason about the same snapshot.
export function detectInventory(devices) {
    if (!devices) {
        return {
            state: "unknown",
            label: "unsupported",
            text: "navigator.mediaDevices.enumerateDevices() is not available here (it needs a secure context: https or localhost).",
            data: { supported: false }
        };
    }

    const cameras = devices.filter((d) => d.kind === "videoinput");
    const mics = devices.filter((d) => d.kind === "audioinput");
    // Labels (and, in most browsers, the full list) are withheld until the
    // page has been granted camera access at least once.
    const labelsVisible = cameras.some((c) => c.label);

    let state, label;
    if (cameras.length === 0) {
        state = "no";
        label = "no camera";
    } else if (cameras.length > 1) {
        state = "warn";
        label = `${cameras.length} cameras`;
    } else {
        state = "yes";
        label = "1 camera";
    }

    return {
        state,
        label,
        text: JSON.stringify(
            {
                videoinputs: cameras.map((c) => c.label || "(label hidden until permission)"),
                audioinputCount: mics.length,
                labelsVisible,
                note: labelsVisible
                    ? (cameras.length > 1
                        ? "More than one camera — common when a virtual camera is installed next to a real one. Card 4 checks which is actually in use."
                        : "Full list, visible because camera access has been granted.")
                    : "Before permission, browsers may cap this list at one device per kind, so the count can't rule a second (virtual) camera out yet."
            },
            null, 2
        ),
        data: { supported: true, cameraCount: cameras.length, labelsVisible }
    };
}
