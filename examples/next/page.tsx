"use client";

// Next.js example: image processing is browser-only, so the
// component is a Client Component. Everything runs on the
// visitor's device — no route handler, no upload, no server cost.
import { useState } from "react";
import { processImage } from "@dusrel/image";

export default function Page() {
  const [url, setUrl] = useState<string | null>(null);
  const [info, setInfo] = useState("");

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const { blob, report } = await processImage(file, {
      format: "image/avif", // canvas AVIF where supported; throws otherwise —
      // fallback: "downgrade-format" would walk avif → webp → jpeg instead
      quality: 0.6,
      resize: { width: 1600 },
    });
    setUrl(URL.createObjectURL(blob));
    setInfo(`${file.size} → ${blob.size} bytes · ${report.stepsApplied.join(", ")}`);
  }

  return (
    <main>
      <h1>@dusrel/image — Next.js</h1>
      <input type="file" accept="image/*" onChange={onFile} />
      {url && (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Processed" style={{ maxWidth: "100%" }} />
          <figcaption>{info}</figcaption>
        </figure>
      )}
    </main>
  );
}
