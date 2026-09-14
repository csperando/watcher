# Multi-Monitor Detection Tests

[https://csperando.github.io/watcher/](https://csperando.github.io/watcher/)

This application consists of eight separate tests aimed at reproducing 
how a website can detect a second display, usually without 
asking for any permission. A summary of the implementation 
for each of the eight methods is provided below.

## 1. `screen.isExtended`

A boolean on `window.screen` that reports whether the display setup is
extended across multiple screens. No permission prompt required — this is
almost certainly what most sites use, and is likely what tipped you off.

## 2. `getScreenDetails()`

The full Window Management API. Returns an array of every connected screen
with size, position, and primary/internal flags. Requires a user gesture and
an explicit permission grant, so it can't run silently on page load.

## 3. Permissions API state (no prompt)

`navigator.permissions.query({ name: "window-management" })` silently reveals
whether that permission is already granted, denied, or unset — without ever
showing a dialog. A prior grant lets a site skip straight to method 2.

## 4. Heuristic: `screen.availLeft` / `availTop`

Non-standard but long-supported properties. A non-zero value suggests a
display positioned to the left of or above the primary one — a hint of a
multi-monitor layout with zero permissions involved.

## 5. Heuristic: window position vs. screen bounds

Polls `window.screenX`/`screenY` against `screen.width`/`height`. If the
window is ever positioned or dragged outside the primary screen's bounds,
another display must exist.

## 6. Tamper / spoof detection for `isExtended`

Users and privacy tools (e.g. Brave, hardened browsers, anti-fingerprinting
extensions) can override `isExtended` to always report `false`. This method
checks whether the property's getter is still native code, and cross-checks
its answer against methods 4 and 5 for consistency.

## 7. Hardware signal: display refresh-rate (vsync) timing

Counts `requestAnimationFrame` callbacks over a fixed window to measure the
monitor's actual refresh rate from real vsync timing, rather than an
OS-reported flag. Re-measures periodically; a shift in Hz with no
display-settings change usually means the window crossed onto a different
physical screen with a different refresh rate. Grounded in real hardware
timing rather than a settable property, so it's harder to convincingly spoof
than methods 1–6.

## 8. Context signal: is this even physical hardware?

Reads the WebGL renderer/vendor strings, which often name the virtual GPU
driver in a VM (VMware SVGA3D, VirtualBox, Hyper-V) or a software renderer
(llvmpipe, SwiftShader). Doesn't detect monitors directly — it's a trust
modifier for the other seven: inside a VM, virtual display counts are
whatever the hypervisor is configured to present, and method 7's "hardware"
refresh-rate timing is usually a synthetic, hypervisor-emulated 60Hz rather
than a real vsync signal.

## Limitations

- **Feature detection isn't tamper detection.** A missing API (`"isExtended"
  in screen` is `false`) is an honest signal — usually an unsupported browser
  or an enterprise policy. A *present but overridden* API is not detectable
  the same way.
- **The native-code check can be defeated.** Sophisticated spoofers (Brave's
  fingerprint randomization included) also patch `Function.prototype.toString`
  so an overridden getter still claims to be `[native code]`.
- **Cross-signal checks only catch inconsistency, not truth.** If every
  signal is spoofed in agreement, nothing on this page can tell.
- **Chromium-only for methods 2 and 3.** `getScreenDetails()` and the
  `window-management` permission are not implemented in Firefox or Safari at
  time of writing.
- **Heuristics require interaction.** Methods 4 and 5 can only confirm a
  multi-monitor setup they've actually observed (e.g. after a drag); they
  can't rule one out.
- **Refresh-rate timing is noisy.** OS power throttling, background-tab
  throttling, and CPU load can shift the measured Hz with no monitor change
  involved, producing false positives.
- **True hardware enumeration isn't reachable from a webpage at all.**
  OS-level display APIs (`EnumDisplayMonitors`, `CGDisplayCopyAllDisplayIDs`,
  `xrandr`) are outside the browser sandbox by design. Getting that ground
  truth requires stepping outside the page entirely — a browser extension
  with a native-messaging host, or a desktop companion app — which needs the
  user to install something, a fundamentally different threat model than a
  passive page fingerprinting silently.
- **Virtual machines and remote sessions undermine nearly everything above.**
  Inside a VM (or an RDP/VNC/cloud-desktop session), every guest-OS-reported
  signal — screen count, position, and even refresh-rate timing — reflects
  the hypervisor's virtual display emulation, not physical hardware. A
  session can also dynamically span a client's several physical monitors
  into what the guest sees as a single screen, or the reverse. Method 8's
  renderer check is a hint, not proof: it can miss unusual real GPUs and
  can't detect virtualization that spoofs the renderer string too.
