// ---------- 3. Permissions API ----------
export async function checkPermissionState() {
    if (!navigator.permissions || !navigator.permissions.query) {
        return {
            status: null,
            result: {
                state: "unknown",
                label: "unsupported",
                text: "navigator.permissions is not available in this browser."
            }
        };
    }

    try {
        const status = await navigator.permissions.query({ name: "window-management" });
        return {
            status,
            result: {
                state: status.state === "granted" ? "yes" : status.state === "denied" ? "no" : "warn",
                label: status.state,
                text: JSON.stringify({ "window-management permission": status.state }, null, 2)
            }
        };
    } catch (err) {
        return {
            status: null,
            result: {
                state: "unknown",
                label: "unsupported",
                text: "window-management is not a recognized permission name here: " + err.message
            }
        };
    }
}
