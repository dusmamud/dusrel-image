---
"@dusrel/image-jpeg": patch
"@dusrel/image-webp": patch
"@dusrel/image-avif": patch
"@dusrel/image-jxl": patch
"@dusrel/image-heic": patch
---

Fix the codec function binding so `setCodecAssets` works after first
use. The cwrap'd encode/decode functions were cached from the first
WASM module instance while `setCodecAssets` cleared the loader cache,
so calling it after a codec had already run paired the old instance's
functions with the new module's memory and silently produced empty
output. Functions are now rebound whenever the module instance
changes. (Lockstep: all @dusrel packages move to 1.0.1 together.)
