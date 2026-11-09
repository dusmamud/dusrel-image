<script setup lang="ts">
import { withBase } from "vitepress";

const year = 2026;
</script>

<template>
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-grid">
        <div class="footer-brand">
          <a class="footer-logo" href="/dusrel-image/">
            <img :src="withBase('/logo.svg')" alt="Dusrel logo" width="34" height="34" />
            <span>@dusrel/image</span>
          </a>
          <p>
            Client-side image processing for any web app. No backend, no
            uploads, no server cost — WASM codecs with maximum developer
            control.
          </p>
          <p class="footer-brand-links">
            <a href="https://github.com/dusmamud/dusrel-image" target="_blank" rel="noreferrer">GitHub</a>
            ·
            <a href="https://www.npmjs.com/package/@dusrel/image" target="_blank" rel="noreferrer">npm</a>
            ·
            <a href="https://dusrel.com" target="_blank" rel="noreferrer">dusrel.com</a>
          </p>
        </div>

        <nav class="footer-col" aria-label="Guides">
          <h3>Guides</h3>
          <a href="/dusrel-image/guide/quickstart">Quickstart</a>
          <a href="/dusrel-image/guide/concepts">Core concepts</a>
          <a href="/dusrel-image/guide/cookbook">Cookbook</a>
          <a href="/dusrel-image/guide/frameworks">Frameworks</a>
          <a href="/dusrel-image/guide/bundlers">Bundlers &amp; codec assets</a>
        </nav>

        <nav class="footer-col" aria-label="Reference">
          <h3>Reference</h3>
          <a href="/dusrel-image/packages">All packages</a>
          <a href="/dusrel-image/api/index.html">API reference</a>
          <a href="/dusrel-image/guide/codec-guide">Codec guide</a>
          <a href="/dusrel-image/guide/browser-support">Browser support</a>
          <a href="https://dusmamud.github.io/dusrel-image/playground/">Playground</a>
        </nav>

        <nav class="footer-col" aria-label="Project">
          <h3>Project</h3>
          <a href="/dusrel-image/guide/roadmap">Roadmap</a>
          <a href="/dusrel-image/guide/release">Release process</a>
          <a href="https://github.com/dusmamud/dusrel-consumer-test" target="_blank" rel="noreferrer">
            Consumer test
          </a>
          <a href="https://github.com/dusmamud/dusrel-image/releases" target="_blank" rel="noreferrer">
            Releases
          </a>
          <a href="https://github.com/dusmamud/dusrel-image/issues" target="_blank" rel="noreferrer">
            Issues
          </a>
        </nav>
      </div>

      <div class="footer-bottom">
        <span>© {{ year }} Dus Mamud · Released under the MIT License</span>
        <span class="footer-note">
          HEIC engine (libheif/libde265) is LGPL-3.0, fenced to its own package · A
          <a href="https://dusrel.com" target="_blank" rel="noreferrer">Dusrel</a> project
        </span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  border-top: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
  padding: 48px 24px 32px;
  margin-top: 64px;
}

.footer-inner {
  max-width: 1152px;
  margin: 0 auto;
}

.footer-grid {
  display: grid;
  grid-template-columns: 1.6fr 1fr 1fr 1fr;
  gap: 40px 32px;
}

.footer-logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: "Sora", "Inter", ui-sans-serif, system-ui, sans-serif;
  font-weight: 700;
  font-size: 17px;
  color: var(--vp-c-text-1);
}

.footer-logo img {
  border-radius: 8px;
}

.footer-brand p {
  margin: 14px 0 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  max-width: 36ch;
}

.footer-brand-links {
  font-size: 14px;
}

.footer-brand-links a,
.footer-bottom a {
  color: var(--vp-c-brand-1);
  font-weight: 500;
}

.footer-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.footer-col h3 {
  font-family: "Sora", "Inter", ui-sans-serif, system-ui, sans-serif;
  font-size: 14px;
  font-weight: 700;
  color: var(--vp-c-text-1);
  margin: 4px 0 6px;
}

.footer-col a {
  font-size: 14px;
  color: var(--vp-c-text-2);
}

.footer-col a:hover,
.footer-brand-links a:hover,
.footer-bottom a:hover {
  color: var(--vp-c-brand-1);
  text-decoration: underline;
}

.footer-bottom {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  justify-content: space-between;
  border-top: 1px solid var(--vp-c-divider);
  margin-top: 40px;
  padding-top: 20px;
  font-size: 13px;
  color: var(--vp-c-text-3);
}

@media (max-width: 860px) {
  .footer-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 560px) {
  .site-footer {
    padding: 36px 20px 28px;
  }

  .footer-grid {
    grid-template-columns: 1fr;
    gap: 28px;
  }

  .footer-bottom {
    flex-direction: column;
  }
}
</style>
