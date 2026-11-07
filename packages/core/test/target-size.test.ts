import { describe, expect, it } from "vitest";
import { findQualityForTargetSize } from "../src/target-size.js";
import { DusrelImageError } from "../src/errors.js";

// Fake encoder: size grows quadratically with quality, like real JPEG/WebP.
const fakeEncode = async (quality: number) => ({
  value: `encoded@${quality.toFixed(3)}`,
  sizeBytes: Math.round(1000 + quality * quality * 9000),
});

describe("findQualityForTargetSize", () => {
  it("returns immediately when max quality already fits", async () => {
    const r = await findQualityForTargetSize(fakeEncode, 20_000, { maxQuality: 0.85 });
    expect(r.met).toBe(true);
    expect(r.quality).toBe(0.85);
    expect(r.attempts).toBe(1);
  });

  it("finds a quality within budget and stays near the top", async () => {
    const r = await findQualityForTargetSize(fakeEncode, 4000, { maxQuality: 0.9 });
    expect(r.met).toBe(true);
    expect(r.sizeBytes).toBeLessThanOrEqual(4000);
    // size(q) = 1000 + 9000q^2 <= 4000  =>  q <= 0.577
    expect(r.quality).toBeGreaterThan(0.5);
    expect(r.quality).toBeLessThanOrEqual(0.6);
    expect(r.attempts).toBeLessThanOrEqual(8);
  });

  it("returns the smallest best effort when the budget is impossible", async () => {
    const r = await findQualityForTargetSize(fakeEncode, 500, { maxQuality: 0.9 });
    expect(r.met).toBe(false);
    expect(r.quality).toBe(0.05);
    expect(r.sizeBytes).toBe(1023); // 1000 + 9000 * 0.05^2 = 1022.5 -> 1023
  });

  it("rejects a non-positive budget", async () => {
    await expect(
      findQualityForTargetSize(fakeEncode, 0, { maxQuality: 0.9 }),
    ).rejects.toBeInstanceOf(DusrelImageError);
  });

  it("honours an aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      findQualityForTargetSize(fakeEncode, 4000, { maxQuality: 0.9, signal: controller.signal }),
    ).rejects.toMatchObject({ code: "aborted" });
  });
});
