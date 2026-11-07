# @dusrel/image-crop

Interactive cropping for the @dusrel/image family — an
accessible Web Component that returns **geometry only**, plus
the pure geometry core underneath it. The pipeline applies the
crop; this package never touches a pixel.

```bash
npm install @dusrel/image-crop
```

```html
<script type="module">
  import { defineCropElement } from '@dusrel/image-crop/element';
  defineCropElement();
</script>

<dusrel-crop src="photo.jpg" aspect="16/9" style="width: 640px; height: 420px"></dusrel-crop>

<script type="module">
  import { processImage } from '@dusrel/image';
  const el = document.querySelector('dusrel-crop');
  el.addEventListener('crop-change', async (e) => {
    const { blob } = await processImage(file, { crop: e.detail.crop });
  });
</script>
```

## The component

| Member | Meaning |
| --- | --- |
| `src` attribute | Image URL (any `<img>` source) |
| `aspect` attribute | `"16/9"`, `"1/1"`, `"1.5"` — locks the ratio; absent = free |
| `shape` attribute | `"rect"` (default) or `"circle"` (square crop, round mask) |
| `value` / `getCrop()` | Current crop in **natural image pixels**: `{ x, y, width, height }` |
| `setCrop(rect)` | Programmatic set (clamped, aspect enforced) |
| `zoomIn()` / `zoomOut()` / `resetView()` | View control for your own buttons |
| `crop-change` event | `detail.crop` on load and after every interaction |

Interactions: drag the box to move it, drag the 8 handles to
resize, drag outside the box to pan the image, mouse wheel to
zoom. **Keyboard** (box focused): arrow keys move by 1 natural
pixel (Shift = 10), Alt+arrows resize, `+`/`-` zoom. The box is
a focusable group whose aria-label announces the live crop
region, with instructions for screen readers.

## The geometry core (`@dusrel/image-crop`)

```ts
import { initialCrop, clampCrop, moveCrop, resizeCrop, fitRect } from '@dusrel/image-crop';
```

Pure functions in natural pixels: `clampCrop` (bounds + min
sizes + aspect), `initialCrop` (centred coverage crop),
`moveCrop`, `resizeCrop` (8 handles; with an aspect lock,
corner drags follow the dominant axis and edge drags keep the
perpendicular centre), and `fitRect` / `displayToNatural` /
`naturalToDisplay` for view mapping. Build a custom UI on them
if the component doesn't fit — that's why they're the main
entry and the component is the subpath.

## Status

Implemented (Phase 3). Geometry proven by exact-value Node unit
tests; the Playwright suite mounts the real component in
Chromium, Firefox and WebKit (initial crop event, keyboard
moves in natural pixels, aspect locking).
