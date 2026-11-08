import { defineConfig } from "vitepress";

export default defineConfig({
  title: "@dusrel/image",
  description:
    "Tiny, no-backend, client-side image processing for any web app — compress, crop, resize, rotate, convert, with WASM codecs and maximum developer control.",
  cleanUrls: true,
  // The TypeDoc HTML reference lives in public/api and is copied
  // verbatim — keep VitePress out of it.
  srcExclude: ["public/**", "README.md"],
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/quickstart" },
      { text: "Architecture", link: "/guide/architecture" },
      { text: "Packages", link: "/packages" },
      { text: "API reference", link: "/api/index.html" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Quickstart", link: "/guide/quickstart" },
          { text: "Architecture", link: "/guide/architecture" },
          { text: "API design", link: "/guide/api-design" },
          { text: "Codec guide", link: "/guide/codec-guide" },
          { text: "Browser support", link: "/guide/browser-support" },
          { text: "Performance", link: "/guide/performance" },
          { text: "Testing", link: "/guide/testing" },
          { text: "Release process", link: "/guide/release" },
          { text: "Roadmap", link: "/guide/roadmap" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "All packages", link: "/packages" },
          { text: "API reference (TypeDoc)", link: "/api/index.html" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/dusmamud/dusrel-image" }],
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026 Dus Mamud",
    },
  },
});
