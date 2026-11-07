import { useState } from "react";
import { processImage } from "@dusrel/image";

// React example: pick a file, process it entirely client-side,
// preview + download the result, and show the process report.
export default function App() {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const { blob, report } = await processImage(file, {
        format: "image/webp",
        quality: 0.82,
        resize: { width: 1600 },
        // A hard byte budget instead of a quality guess:
        // targetSize: 200_000,
      });
      setResult({ url: URL.createObjectURL(blob), size: blob.size, report });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>@dusrel/image — React</h1>
      <input type="file" accept="image/*" onChange={onFile} disabled={busy} />
      {result && (
        <figure>
          <img src={result.url} alt="Processed" style={{ maxWidth: "100%" }} />
          <figcaption>
            {result.size} bytes · steps: {result.report.stepsApplied.join(", ")}
            {" · "}
            <a href={result.url} download="processed.webp">
              Download
            </a>
          </figcaption>
        </figure>
      )}
    </main>
  );
}
