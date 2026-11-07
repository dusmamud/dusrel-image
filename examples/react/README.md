# React example

`App.jsx` — drop it into any Vite/Next/CRA app after
`npm install @dusrel/image`.

For the crop UI, register the Web Component once
(`import { defineCropElement } from '@dusrel/image-crop/element'`)
and use `<dusrel-crop>` in JSX with a ref to read `.value` —
Web Components work in React as-is; the framework wrappers
(`@dusrel/image-react`) arrive in Phase 4 for typed props.
