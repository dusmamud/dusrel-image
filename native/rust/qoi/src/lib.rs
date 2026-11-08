//! @dusrel/image-qoi — glue over the Rust `qoi` crate (our own code).
//!
//! encode build: dusrel_qoi_encode(rgba, w, h) -> QOI bytes
//!   (always RGBA in, channels inferred by the crate; the QOI
//!   header records 4 channels + sRGB).
//! decode build: dusrel_qoi_decode(bytes) -> [w u32 LE][h u32 LE][RGBA]
//!   (RGB sources are expanded with alpha 255, matching the family
//!   decode convention used by @dusrel/image-png).
use wasm_bindgen::prelude::*;

fn err(e: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&e.to_string())
}

#[cfg(feature = "encode")]
#[wasm_bindgen]
pub fn dusrel_qoi_encode(rgba: &[u8], width: u32, height: u32) -> Result<Vec<u8>, JsValue> {
    let expected = (width as usize) * (height as usize) * 4;
    if rgba.len() != expected {
        return Err(JsValue::from_str(&format!(
            "RGBA length {} does not match {width}x{height} ({expected})",
            rgba.len()
        )));
    }
    qoi::encode_to_vec(rgba, width, height).map_err(err)
}

#[cfg(feature = "decode")]
#[wasm_bindgen]
pub fn dusrel_qoi_decode(data: &[u8]) -> Result<Vec<u8>, JsValue> {
    let (header, pixels) = qoi::decode_to_vec(data).map_err(err)?;
    let (w, h) = (header.width as usize, header.height as usize);
    let channels = header.channels.as_u8() as usize;
    let mut out = Vec::with_capacity(8 + w * h * 4);
    out.extend_from_slice(&header.width.to_le_bytes());
    out.extend_from_slice(&header.height.to_le_bytes());
    match channels {
        4 => out.extend_from_slice(&pixels),
        3 => {
            for rgb in pixels.chunks_exact(3) {
                out.extend_from_slice(rgb);
                out.push(255);
            }
        }
        other => {
            return Err(JsValue::from_str(&format!(
                "unsupported QOI channel count {other}"
            )));
        }
    }
    Ok(out)
}
