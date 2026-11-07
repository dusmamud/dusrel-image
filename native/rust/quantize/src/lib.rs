//! Glue for @dusrel/image-quantize: colour quantization (RGBA image
//! -> <=256-colour palette + per-pixel indices) via the quantizr
//! crate — the permissive MIT engine chosen to replace GPL
//! libimagequant (ADR-0003 addendum, 2026-11-07).
//!
//! dusrel_quantize(rgba, w, h, max_colors, dithering) ->
//!   [palette_count u32 LE][error f32 bits u32 LE]
//!   [palette RGBA * count][indices u8 * w*h]
//! dithering: 0.0 (none) .. 1.0 (full Floyd-Steinberg-style spread).

use wasm_bindgen::prelude::*;

fn err<E: std::fmt::Display>(e: E) -> JsValue {
    JsValue::from_str(&e.to_string())
}

#[wasm_bindgen]
pub fn dusrel_quantize(
    rgba: Vec<u8>,
    width: u32,
    height: u32,
    max_colors: i32,
    dithering: f32,
) -> Result<Vec<u8>, JsValue> {
    let (w, h) = (width as usize, height as usize);
    if rgba.len() != w * h * 4 {
        return Err(err(format!(
            "input length {} does not match {w}x{h} RGBA",
            rgba.len()
        )));
    }
    let image = quantizr::Image::new(&rgba, w, h).map_err(err)?;
    let mut options = quantizr::Options::default();
    options.set_max_colors(max_colors).map_err(err)?;
    let mut result = quantizr::QuantizeResult::quantize(&image, &options);
    result.set_dithering_level(dithering).map_err(err)?;
    let palette = result.get_palette();
    let count = palette.count as usize;
    let mut indices = vec![0u8; w * h];
    result.remap_image(&image, &mut indices).map_err(err)?;
    let mut out = Vec::with_capacity(8 + count * 4 + indices.len());
    out.extend_from_slice(&(palette.count).to_le_bytes());
    out.extend_from_slice(&result.get_error().to_bits().to_le_bytes());
    for entry in palette.entries.iter().take(count) {
        out.extend_from_slice(&[entry.r, entry.g, entry.b, entry.a]);
    }
    out.extend_from_slice(&indices);
    Ok(out)
}
