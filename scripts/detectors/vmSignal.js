// ---------- 8. VM / virtualization context signal ----------
// Shared with method 2's label check (screenDetails.js) — both are
// substring-matching a string an attacker could set to anything, so they
// use the same hint vocabulary rather than maintaining two lists.
export const VM_HINTS = [
    "vmware", "virtualbox", "vbox", "parallels", "llvmpipe", "swiftshader",
    "basic render", "basic display", "microsoft basic", "hyper-v",
    "virtual", "qemu", "bochs", "remote desktop", "rdp"
];

export function detectVmSignal() {
    let info;
    try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (!gl) throw new Error("WebGL not available");
        const dbg = gl.getExtension("WEBGL_debug_renderer_info");
        info = dbg
            ? { renderer: gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL), vendor: gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL), unmasked: true }
            : { renderer: gl.getParameter(gl.RENDERER), vendor: gl.getParameter(gl.VENDOR), unmasked: false };
    } catch (err) {
        return {
            state: "unknown",
            label: "unavailable",
            text: "Could not read WebGL renderer info: " + err.message,
            data: { available: false }
        };
    }

    const haystack = `${info.renderer} ${info.vendor}`.toLowerCase();
    const matchedHint = VM_HINTS.find((hint) => haystack.includes(hint));
    const likelyVirtual = !!matchedHint;

    return {
        state: likelyVirtual ? "warn" : "yes",
        label: likelyVirtual ? "likely virtualized" : "looks physical",
        text: JSON.stringify(
            {
                renderer: info.renderer,
                vendor: info.vendor,
                unmasked: info.unmasked,
                matchedHint: matchedHint || null,
                note: likelyVirtual
                    ? "Renderer string suggests a virtual/software GPU — treat methods 1-7 as reporting on the guest OS's virtual display config, not physical monitors, and don't trust method 7's Hz as real vsync."
                    : "No VM/software-render hint found — not proof of physical hardware (spoofable, and some real GPUs use generic names), just no obvious signal against it."
            },
            null, 2
        ),
        data: { available: true, renderer: info.renderer, vendor: info.vendor, matchedHint: matchedHint || null, likelyVirtual }
    };
}
