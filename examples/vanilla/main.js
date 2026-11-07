import { imageDataPlugin, pipeline } from "@dusrel/image";
import { adjust } from "@dusrel/image-adjust";

const input = document.getElementById("file");
const out = document.getElementById("out");
const img = document.getElementById("img");

input.addEventListener("change", async () => {
  const file = input.files[0];
  if (!file) return;
  // One fluent pipeline: canvas steps merge into a single pass,
  // the adjust plugin runs at its exact position in the chain.
  const { blob, report } = await pipeline(file)
    .resize({ width: 1200 })
    .use(
      imageDataPlugin({
        name: "adjust",
        transform: (data) => adjust(data, { brightness: 0.05, saturation: 0.1 }),
      }),
    )
    .toFormat("image/webp", 0.82)
    .run();
  img.src = URL.createObjectURL(blob);
  out.textContent = `${file.name}: ${file.size} → ${blob.size} bytes · steps: ${report.stepsApplied.join(", ")}`;
});
