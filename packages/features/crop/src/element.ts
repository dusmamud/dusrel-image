import {
  clampCrop,
  fitRect,
  initialCrop,
  moveCrop,
  resizeCrop,
  type CropConstraints,
  type CropRect,
  type ResizeHandle,
  type Size,
} from "./geometry.js";

export interface CropChangeDetail {
  crop: CropRect;
}

const HANDLES: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const CURSORS: Record<ResizeHandle, string> = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
};

function parseAspect(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const fraction = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(raw.trim());
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

interface DragState {
  kind: "move" | "resize" | "pan";
  handle?: ResizeHandle;
  startX: number;
  startY: number;
  startCrop: CropRect;
  startPan: { x: number; y: number };
}

/**
 * <dusrel-crop> — an accessible, framework-free crop UI.
 *
 * It returns GEOMETRY ONLY (natural image pixels, the exact shape
 * @dusrel/image-core's crop option takes) via the `value`
 * property and `crop-change` events; the pipeline applies it.
 *
 * Interactions: drag the box to move, drag its 8 handles to
 * resize, drag outside the box to pan, wheel to zoom. Keyboard
 * (box focused): arrow keys move by 1 natural px (Shift = 10),
 * Alt+arrows resize, +/- zoom. The box carries an aria-label
 * that announces the live crop region.
 *
 * Attributes: `src`, `aspect` ("16/9" or "1.5"), `shape`
 * ("rect" | "circle").
 */
export class DusrelCropElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["src", "aspect", "shape"];
  }

  private readonly container: HTMLDivElement;
  private readonly img: HTMLImageElement;
  private readonly box: HTMLDivElement;
  private readonly instructions: HTMLSpanElement;
  private readonly handleEls = new Map<ResizeHandle, HTMLDivElement>();
  private crop: CropRect = { x: 0, y: 0, width: 0, height: 0 };
  private natural: Size = { width: 0, height: 0 };
  private zoom = 1;
  private pan = { x: 0, y: 0 };
  private drag: DragState | undefined;
  private resizeObserver: ResizeObserver | undefined;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host { display: block; position: relative; overflow: hidden; background: #111; touch-action: none; }
      .container { position: absolute; inset: 0; overflow: hidden; }
      img { position: absolute; user-select: none; -webkit-user-drag: none; }
      .box {
        position: absolute; border: 1.5px solid #fff; outline: 1px solid rgba(0,0,0,.4);
        box-shadow: 0 0 0 9999px rgba(0,0,0,.5); cursor: move; box-sizing: border-box;
      }
      .box:focus-visible { outline: 2px solid #4da3ff; outline-offset: 1px; }
      .box.circle { border-radius: 50%; }
      .handle {
        position: absolute; width: 12px; height: 12px; margin: -6px 0 0 -6px;
        background: #fff; border: 1px solid rgba(0,0,0,.45); border-radius: 2px; box-sizing: border-box;
      }
      .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    `;
    this.container = document.createElement("div");
    this.container.className = "container";
    this.img = document.createElement("img");
    this.img.alt = "";
    this.img.draggable = false;
    this.box = document.createElement("div");
    this.box.className = "box";
    this.box.dataset["part"] = "box";
    this.box.tabIndex = 0;
    this.box.setAttribute("role", "group");
    for (const handle of HANDLES) {
      const el = document.createElement("div");
      el.className = "handle";
      el.dataset["handle"] = handle;
      el.style.cursor = CURSORS[handle];
      el.setAttribute("aria-hidden", "true");
      this.handleEls.set(handle, el);
      this.box.appendChild(el);
    }
    this.instructions = document.createElement("span");
    this.instructions.className = "sr";
    this.instructions.textContent =
      "Crop region. Arrow keys move the crop. Shift plus arrows moves faster. Alt plus arrow keys resize. Plus and minus zoom.";
    const describedBy = `dusrel-crop-help-${Math.random().toString(36).slice(2, 8)}`;
    this.instructions.id = describedBy;
    this.box.setAttribute("aria-describedby", describedBy);
    this.container.append(this.img, this.box, this.instructions);
    root.append(style, this.container);

    this.img.addEventListener("load", () => this.onImageLoad());
    this.box.addEventListener("pointerdown", (e) => this.onPointerDown(e, "box"));
    this.container.addEventListener("pointerdown", (e) => {
      if (e.target === this.container || e.target === this.img) this.onPointerDown(e, "pan");
    });
    this.container.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });
    this.box.addEventListener("keydown", (e) => this.onKeyDown(e));
  }

  connectedCallback(): void {
    this.resizeObserver = new ResizeObserver(() => this.render());
    this.resizeObserver.observe(this);
    if (this.img.complete && this.img.naturalWidth > 0 && this.natural.width === 0) {
      this.onImageLoad();
    }
    this.render();
  }

  disconnectedCallback(): void {
    this.resizeObserver?.disconnect();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === "src") {
      if (value) this.img.src = value;
    } else if (this.natural.width > 0) {
      this.crop = clampCrop(this.crop, this.natural, this.constraints());
      this.render();
      this.emitChange();
    }
  }

  /** The current crop in natural image pixels. */
  get value(): CropRect {
    return { ...this.crop };
  }

  setCrop(rect: CropRect): void {
    this.crop = clampCrop(rect, this.natural, this.constraints());
    this.render();
    this.emitChange();
  }

  getCrop(): CropRect {
    return this.value;
  }

  zoomIn(): void {
    this.setZoom(this.zoom * 1.25);
  }
  zoomOut(): void {
    this.setZoom(this.zoom / 1.25);
  }
  resetView(): void {
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.render();
  }

  private constraints(): CropConstraints {
    const shape = this.getAttribute("shape") === "circle" ? "circle" : "rect";
    const aspect = parseAspect(this.getAttribute("aspect"));
    return aspect === undefined ? { shape } : { shape, aspect };
  }

  private setZoom(zoom: number): void {
    this.zoom = Math.min(8, Math.max(1, zoom));
    this.render();
  }

  private onImageLoad(): void {
    this.natural = { width: this.img.naturalWidth, height: this.img.naturalHeight };
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.crop = initialCrop(this.natural, this.constraints());
    this.render();
    this.emitChange();
  }

  /** Current view: the fitted image rect scaled by zoom, plus pan. */
  private view(): { x: number; y: number; width: number; height: number; scale: number } {
    const box = { width: this.clientWidth || 640, height: this.clientHeight || 480 };
    const fit = fitRect(this.natural, box);
    const scale = fit.scale * this.zoom;
    const width = this.natural.width * scale;
    const height = this.natural.height * scale;
    return {
      x: (box.width - width) / 2 + this.pan.x,
      y: (box.height - height) / 2 + this.pan.y,
      width,
      height,
      scale,
    };
  }

  private render(): void {
    if (this.natural.width === 0) return;
    const v = this.view();
    this.img.style.left = `${v.x}px`;
    this.img.style.top = `${v.y}px`;
    this.img.style.width = `${v.width}px`;
    this.img.style.height = `${v.height}px`;
    const boxX = v.x + this.crop.x * v.scale;
    const boxY = v.y + this.crop.y * v.scale;
    const boxW = this.crop.width * v.scale;
    const boxH = this.crop.height * v.scale;
    this.box.style.left = `${boxX}px`;
    this.box.style.top = `${boxY}px`;
    this.box.style.width = `${boxW}px`;
    this.box.style.height = `${boxH}px`;
    this.box.classList.toggle("circle", this.getAttribute("shape") === "circle");
    const positions: Record<ResizeHandle, [number, number]> = {
      nw: [0, 0],
      n: [boxW / 2, 0],
      ne: [boxW, 0],
      e: [boxW, boxH / 2],
      se: [boxW, boxH],
      s: [boxW / 2, boxH],
      sw: [0, boxH],
      w: [0, boxH / 2],
    };
    for (const [handle, el] of this.handleEls) {
      const [hx, hy] = positions[handle];
      el.style.left = `${hx}px`;
      el.style.top = `${hy}px`;
    }
    this.box.setAttribute(
      "aria-label",
      `Crop region: x ${this.crop.x}, y ${this.crop.y}, width ${this.crop.width}, height ${this.crop.height}, in a ${this.natural.width} by ${this.natural.height} image.`,
    );
  }

  private emitChange(): void {
    this.dispatchEvent(
      new CustomEvent<CropChangeDetail>("crop-change", {
        detail: { crop: this.value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onPointerDown(event: PointerEvent, zone: "box" | "pan"): void {
    if (this.natural.width === 0) return;
    const target = event.target as HTMLElement;
    const handle = target.dataset["handle"] as ResizeHandle | undefined;
    const kind = zone === "pan" ? "pan" : handle ? "resize" : "move";
    this.drag = {
      kind,
      ...(handle ? { handle } : {}),
      startX: event.clientX,
      startY: event.clientY,
      startCrop: { ...this.crop },
      startPan: { ...this.pan },
    };
    const move = (e: PointerEvent) => this.onPointerMove(e);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (this.drag) {
        this.drag = undefined;
        this.emitChange();
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    event.preventDefault();
  }

  private onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag) return;
    const v = this.view();
    const dxDisplay = event.clientX - drag.startX;
    const dyDisplay = event.clientY - drag.startY;
    if (drag.kind === "pan") {
      this.pan = { x: drag.startPan.x + dxDisplay, y: drag.startPan.y + dyDisplay };
      this.render();
      return;
    }
    const dx = dxDisplay / v.scale;
    const dy = dyDisplay / v.scale;
    this.crop =
      drag.kind === "move"
        ? moveCrop(drag.startCrop, dx, dy, this.natural, this.constraints())
        : resizeCrop(drag.startCrop, drag.handle!, dx, dy, this.natural, this.constraints());
    this.render();
  }

  private onWheel(event: WheelEvent): void {
    if (this.natural.width === 0) return;
    event.preventDefault();
    this.setZoom(this.zoom * Math.exp(-event.deltaY * 0.0015));
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (this.natural.width === 0) return;
    const step = event.shiftKey ? 10 : 1;
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const arrow = arrows[event.key];
    if (arrow) {
      event.preventDefault();
      this.crop = event.altKey
        ? resizeCrop(this.crop, "se", arrow[0], arrow[1], this.natural, this.constraints())
        : moveCrop(this.crop, arrow[0], arrow[1], this.natural, this.constraints());
      this.render();
      this.emitChange();
      return;
    }
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      this.zoomIn();
    } else if (event.key === "-") {
      event.preventDefault();
      this.zoomOut();
    }
  }
}

/** Registers <dusrel-crop> (idempotent; a custom tag name is allowed). */
export function defineCropElement(tag = "dusrel-crop"): void {
  if (!customElements.get(tag)) {
    customElements.define(tag, DusrelCropElement);
  }
}
