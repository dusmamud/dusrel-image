//! Glue for @dusrel/image-resize: high-quality resampling via the
//! Rust `resize` crate (the engine Squoosh/jSquash use).
//!
//! dusrel_resize(rgba, src_w, src_h, dst_w, dst_h, filter,
//!   premultiply) -> [dst_w u32 LE][dst_h u32 LE][RGBA...]
//!   filter: 0 point(nearest), 1 triangle, 2 catrom, 3 mitchell,
//!           4 bspline, 5 gaussian, 6 lanczos3
//!
//! Alpha correctness: browser ImageData is straight (unpremultiplied)
//! alpha. Resampling straight-alpha pixels directly bleeds the RGB
//! of fully transparent pixels into visible edges. With
//! premultiply=true (the wrapper default) the glue premultiplies,
//! resizes with the crate's RGBA8P format, then unpremultiplies —
//! the mathematically correct path. premultiply=false uses the
//! crate's straight RGBA8 format for callers who want raw channel
//! resampling (e.g. data masks).

use resize::Pixel;
use rgb::RGBA8;
use wasm_bindgen::prelude::*;

fn err<E: std::fmt::Display>(e: E) -> JsValue {
    JsValue::from_str(&e.to_string())
}

fn filter_type(code: u8) -> resize::Type {
    match code {
        0 => resize::Type::Point,
        1 => resize::Type::Triangle,
        2 => resize::Type::Catrom,
        3 => resize::Type::Mitchell,
        4 => resize::Type::BSpline,
        5 => resize::Type::Gaussian,
        _ => resize::Type::Lanczos3,
    }
}

fn premultiply(px: &RGBA8) -> RGBA8 {
    let a = u32::from(px.a);
    RGBA8 {
        r: (u32::from(px.r) * a / 255) as u8,
        g: (u32::from(px.g) * a / 255) as u8,
        b: (u32::from(px.b) * a / 255) as u8,
        a: px.a,
    }
}

fn unpremultiply(px: &RGBA8) -> RGBA8 {
    if px.a == 0 {
        return RGBA8 { r: 0, g: 0, b: 0, a: 0 };
    }
    let a = u32::from(px.a);
    let un = |v: u8| ((u32::from(v) * 255 + a / 2) / a).min(255) as u8;
    RGBA8 { r: un(px.r), g: un(px.g), b: un(px.b), a: px.a }
}

#[wasm_bindgen]
pub fn dusrel_resize(
    rgba: Vec<u8>,
    src_w: u32,
    src_h: u32,
    dst_w: u32,
    dst_h: u32,
    filter: u8,
    premultiply_alpha: bool,
) -> Result<Vec<u8>, JsValue> {
    let (sw, sh, dw, dh) = (src_w as usize, src_h as usize, dst_w as usize, dst_h as usize);
    if rgba.len() != sw * sh * 4 {
        return Err(err(format!(
            "input length {} does not match {sw}x{sh} RGBA",
            rgba.len()
        )));
    }
    let src: Vec<RGBA8> = rgba
        .chunks_exact(4)
        .map(|c| RGBA8 { r: c[0], g: c[1], b: c[2], a: c[3] })
        .collect();
    let mut dst: Vec<RGBA8> = vec![RGBA8 { r: 0, g: 0, b: 0, a: 0 }; dw * dh];
    let ft = filter_type(filter);
    if premultiply_alpha {
        let pre: Vec<RGBA8> = src.iter().map(premultiply).collect();
        let mut resizer = resize::new(sw, sh, dw, dh, Pixel::RGBA8P, ft).map_err(err)?;
        resizer.resize(&pre, &mut dst).map_err(err)?;
        for px in dst.iter_mut() {
            *px = unpremultiply(px);
        }
    } else {
        let mut resizer = resize::new(sw, sh, dw, dh, Pixel::RGBA8, ft).map_err(err)?;
        resizer.resize(&src, &mut dst).map_err(err)?;
    }
    let mut out = Vec::with_capacity(8 + dst.len() * 4);
    out.extend_from_slice(&dst_w.to_le_bytes());
    out.extend_from_slice(&dst_h.to_le_bytes());
    for px in &dst {
        out.extend_from_slice(&[px.r, px.g, px.b, px.a]);
    }
    Ok(out)
}
