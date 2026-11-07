import { describe, expect, it } from "vitest";
import { codecPlugin, imageDataPlugin, resolveCodecPluginName } from "../src/codec-plugin.js";

const fakeEncode = async () => new Uint8Array([1, 2, 3]);

describe("codecPlugin", () => {
  it("derives the report name from the MIME type by default", () => {
    expect(resolveCodecPluginName({ mimeType: "image/avif", encode: fakeEncode })).toBe(
      "codec:avif",
    );
    const plugin = codecPlugin({ mimeType: "image/avif", encode: fakeEncode });
    expect(plugin.name).toBe("codec:avif");
    expect(typeof plugin.apply).toBe("function");
  });

  it("honours an explicit name", () => {
    const plugin = codecPlugin({ name: "avif:hero", mimeType: "image/avif", encode: fakeEncode });
    expect(plugin.name).toBe("avif:hero");
  });

  it("rejects definitions without an encoder or a valid MIME type", () => {
    expect(() => codecPlugin({ mimeType: "image/avif", encode: undefined as never })).toThrow(
      TypeError,
    );
    expect(() => codecPlugin({ mimeType: "avif", encode: fakeEncode })).toThrow(TypeError);
    expect(() => codecPlugin({ mimeType: "text/plain", encode: fakeEncode })).toThrow(TypeError);
  });
});

describe("imageDataPlugin", () => {
  it("requires a transform and a name", () => {
    const plugin = imageDataPlugin({ name: "invert", transform: (d) => d });
    expect(plugin.name).toBe("invert");
    expect(() => imageDataPlugin({ name: "", transform: (d) => d })).toThrow(TypeError);
    expect(() => imageDataPlugin({ name: "x", transform: undefined as never })).toThrow(TypeError);
  });
});
