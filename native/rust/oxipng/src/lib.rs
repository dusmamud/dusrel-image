//! Glue for @dusrel/image-oxipng: lossless PNG optimisation via the
//! oxipng crate (levels 0..6 presets, chunk stripping, interlace
//! control) — pixels are never changed, only the encoding.
//!
//! dusrel_oxipng_optimize(data, level, strip, interlace, force)
//!   level: 0..6 (oxipng preset)
//!   strip: 0 none, 1 safe (non-display chunks), 2 all non-critical
//!   interlace: -1 keep (Option::None), 0 off, 1 on. NOTE: oxipng's
//!     own presets default to Some(false) — they de-interlace. Our
//!     "keep" maps to None explicitly, applied AFTER the preset, so
//!     the caller's structure survives unless they ask otherwise.
//!   force: write output even when it is not smaller.

use wasm_bindgen::prelude::*;

fn err<E: std::fmt::Display>(e: E) -> JsValue {
    JsValue::from_str(&e.to_string())
}

#[wasm_bindgen]
pub fn dusrel_oxipng_optimize(
    data: &[u8],
    level: u8,
    strip: u8,
    interlace: i32,
    force: bool,
) -> Result<Vec<u8>, JsValue> {
    let mut opts = oxipng::Options::from_preset(level.min(6));
    opts.strip = match strip {
        1 => oxipng::StripChunks::Safe,
        2 => oxipng::StripChunks::All,
        _ => oxipng::StripChunks::None,
    };
    opts.interlace = match interlace {
        0 => Some(false),
        1 => Some(true),
        _ => None,
    };
    opts.force = force;
    oxipng::optimize_from_memory(data, &opts).map_err(err)
}
