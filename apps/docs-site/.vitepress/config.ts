import { defineConfig } from "vitepress";

export default defineConfig({
  title: "@dusrel/image",
  description:
    "Tiny, no-backend, client-side image processing for any web app — compress, crop, resize, rotate, convert, with WASM codecs and maximum developer control.",
  // Deployed as a GitHub Pages project site:
  // https://dusmamud.github.io/dusrel-image/
  base: "/dusrel-image/",
  cleanUrls: true,
  lastUpdated: true,
  sitemap: { hostname: "https://dusmamud.github.io/dusrel-image/" },
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/dusrel-image/logo.svg" }],
    ["meta", { name: "theme-color", content: "#0e0f12" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "@dusrel/image — client-side image processing" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "Compress, crop, resize, rotate and convert images entirely in the browser. No backend, no uploads — WASM codecs with maximum developer control.",
      },
    ],
  ],
  // The TypeDoc HTML reference lives in public/api and is copied
  // verbatim — keep VitePress out of it.
  srcExclude: ["public/**", "README.md"],
  themeConfig: {
    logo: "/logo.svg",
    notFound: {
      title: "This page wandered off",
      quote: "The image you're looking for was probably compressed out of existence.",
      actions: [
        { theme: "brand", text: "Back to the quickstart", link: "/guide/quickstart" },
        {
          theme: "alt",
          text: "Open the playground",
          link: "https://dusmamud.github.io/dusrel-image/playground/",
        },
      ],
    },
    search: { provider: "local" },
    editLink: {
      pattern: "https://github.com/dusmamud/dusrel-image/edit/main/apps/docs-site/:path",
      text: "Edit this page on GitHub",
    },
    nav: [
      { text: "Guide", link: "/guide/quickstart" },
      { text: "Architecture", link: "/guide/architecture" },
      { text: "Packages", link: "/packages" },
      { text: "API reference", link: "/api/index.html" },
      { text: "Playground", link: "https://dusmamud.github.io/dusrel-image/playground/" },
    ],
    sidebar: [
      {
        text: "Start here",
        items: [
          { text: "Quickstart", link: "/guide/quickstart" },
          { text: "Core concepts", link: "/guide/concepts" },
          { text: "Cookbook", link: "/guide/cookbook" },
        ],
      },
      {
        text: "Guides",
        items: [
          { text: "Frameworks", link: "/guide/frameworks" },
          { text: "Bundlers & codec assets", link: "/guide/bundlers" },
          { text: "Codec guide", link: "/guide/codec-guide" },
          { text: "Browser support", link: "/guide/browser-support" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "All packages", link: "/packages" },
          { text: "API reference (TypeDoc)", link: "/api/index.html" },
          { text: "Architecture", link: "/guide/architecture" },
          { text: "API design", link: "/guide/api-design" },
          { text: "Performance", link: "/guide/performance" },
        ],
      },
      {
        text: "Project",
        items: [
          { text: "Roadmap", link: "/guide/roadmap" },
          { text: "Testing", link: "/guide/testing" },
          { text: "Release process", link: "/guide/release" },
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
