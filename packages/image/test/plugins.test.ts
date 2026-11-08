import { describe, expect, it } from "vitest";
import { DusrelImageError } from "@dusrel/image-core";
import { codecPlugin } from "../src/codec-plugin.js";
import { findCodec, wrapPluginError } from "../src/plugins.js";
import type { CodecPluginDefinition } from "../src/types.js";

const fakeCodec: CodecPluginDefinition = {
  mimeType: "image/x-fake",
  encode: () => new Uint8Array([1, 2, 3]),
};

describe("wrapPluginError (the stabilised error contract)", () => {
  it("passes DusrelImageError through untouched", () => {
    const typed = new DusrelImageError("decode-failed", "nope");
    expect(wrapPluginError("p", typed)).toBe(typed);
  });

  it("wraps a generic failure as plugin-failed, naming the plugin, keeping the cause", () => {
    const cause = new Error("boom");
    const wrapped = wrapPluginError("invert", cause);
    expect(wrapped).toBeInstanceOf(DusrelImageError);
    expect(wrapped.code).toBe("plugin-failed");
    expect(wrapped.message).toContain('"invert"');
    expect(wrapped.message).toContain("boom");
    expect((wrapped as { cause?: unknown }).cause).toBe(cause);
  });

  it("maps an AbortError to the aborted code", () => {
    const abort = new Error("stop");
    abort.name = "AbortError";
    expect(wrapPluginError("p", abort).code).toBe("aborted");
  });

  it("maps a failure under an aborted signal to aborted", () => {
    const controller = new AbortController();
    controller.abort();
    expect(wrapPluginError("p", new Error("x"), controller.signal).code).toBe("aborted");
  });
});

describe("findCodec", () => {
  it("matches MIME types case-insensitively", () => {
    expect(findCodec([fakeCodec], "IMAGE/X-FAKE")).toBe(fakeCodec);
    expect(findCodec([fakeCodec], "image/avif")).toBeUndefined();
    expect(findCodec(undefined, "image/x-fake")).toBeUndefined();
  });
});

describe("codecPlugin format stamping", () => {
  it("the built plugin carries the codec MIME type as its format", () => {
    const plugin = codecPlugin(fakeCodec);
    expect(plugin.format).toBe("image/x-fake");
    expect(plugin.name).toBe("codec:x-fake");
  });
});
