// Browser-test fixture: a real React app using the package's
// hook + crop component, bundled self-contained by tsdown
// (see tsdown.config.ts) and mounted by tests/browser/react.spec.ts.
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { DusrelCrop, useProcessImage } from "../src/index.js";
import type { CropRect } from "@dusrel/image-crop";

function App() {
  const { process, status, result, error } = useProcessImage();
  const [blob, setBlob] = useState<Blob | undefined>(undefined);
  const [crop, setCrop] = useState<CropRect | undefined>(undefined);
  const urlRef = useRef<string>("");

  useEffect(() => {
    let live = true;
    void (async () => {
      const canvas = new OffscreenCanvas(800, 600);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "rgb(30, 100, 200)";
      ctx.fillRect(0, 0, 800, 600);
      ctx.fillStyle = "rgb(250, 200, 40)";
      ctx.fillRect(400, 0, 400, 600);
      const b = await canvas.convertToBlob({ type: "image/png" });
      if (!live) return;
      urlRef.current = URL.createObjectURL(b);
      setBlob(b);
    })();
    return () => {
      live = false;
    };
  }, []);

  return (
    <main>
      {blob && (
        <DusrelCrop
          src={urlRef.current}
          onCropChange={setCrop}
          style={{ width: 400, height: 300, display: "block" }}
        />
      )}
      <div data-testid="crop">{crop ? JSON.stringify(crop) : "none"}</div>
      <button
        data-testid="go"
        disabled={!blob}
        onClick={() => {
          if (blob) {
            void process(blob, {
              format: "image/webp",
              quality: 0.8,
              ...(crop ? { crop } : {}),
            });
          }
        }}
      >
        Process
      </button>
      <div data-testid="status">{status}</div>
      <div data-testid="result">
        {result
          ? `${result.blob.type}:${result.blob.size}:${result.report.stepsApplied.join(",")}`
          : error
            ? `error:${String(error)}`
            : "none"}
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
