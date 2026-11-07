//! @dusrel/image-png — glue over the Rust `png` crate (our own code).
//!
//! encode build: dusrel_png_encode(rgba, w, h, compression, filter)
//!   -> PNG bytes. compression: 0 fast, 1 balanced (default), 2 high
//!   (the png 0.18 Compression scale). filter: 0 none, 1 sub, 2 up,
//!   3 avg, 4 paeth, 5 adaptive. The png crate cannot encode Adam7
//!   interlacing; that control lives in @dusrel/image-oxipng.
//! decode build: dusrel_png_decode(bytes) -> [w u32 LE][h u32 LE][RGBA]
//!   (always RGBA8 out; colour conversion handled here, documented in
//!   the TS wrapper which parses the prefix).
use wasm_bindgen::prelude::*;

fn err(e: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&e.to_string())
}

#[cfg(feature = "encode")]
#[wasm_bindgen]
pub fn dusrel_png_encode(
    rgba: &[u8],
    width: u32,
    height: u32,
    compression: u8,
    filter: u8,
) -> Result<Vec<u8>, JsValue> {
    let expected = (width as usize) * (height as usize) * 4;
    if rgba.len() != expected {
        return Err(JsValue::from_str(&format!(
            "RGBA length {} does not match {width}x{height} ({expected})",
            rgba.len()
        )));
    }
    let mut out: Vec<u8> = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut out, width, height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        encoder.set_compression(match compression {
            0 => png::Compression::Fast,
            2 => png::Compression::High,
            _ => png::Compression::Balanced,
        });
        encoder.set_filter(match filter {
            0 => png::Filter::NoFilter,
            1 => png::Filter::Sub,
            2 => png::Filter::Up,
            3 => png::Filter::Avg,
            4 => png::Filter::Paeth,
            _ => png::Filter::Adaptive,
        });
        let mut writer = encoder.write_header().map_err(err)?;
        writer.write_image_data(rgba).map_err(err)?;
        writer.finish().map_err(err)?;
    }
    Ok(out)
}

#[cfg(feature = "decode")]
#[wasm_bindgen]
pub fn dusrel_png_decode(data: &[u8]) -> Result<Vec<u8>, JsValue> {
    let mut decoder = png::Decoder::new(std::io::Cursor::new(data));
    decoder.set_transformations(png::Transformations::normalize_to_color8());
    let mut reader = decoder.read_info().map_err(err)?;
    let mut buf = vec![0; reader.output_buffer_size()];
    let info = reader.next_frame(&mut buf).map_err(err)?;
    let pixels = &buf[..info.buffer_size()];
    let (w, h) = (info.width as usize, info.height as usize);

    let mut out = Vec::with_capacity(8 + w * h * 4);
    out.extend_from_slice(&info.width.to_le_bytes());
    out.extend_from_slice(&info.height.to_le_bytes());
    match info.color_type {
        png::ColorType::Rgba => out.extend_from_slice(pixels),
        png::ColorType::Rgb => {
            for rgb in pixels.chunks_exact(3) {
                out.extend_from_slice(rgb);
                out.push(255);
            }
        }
        png::ColorType::GrayscaleAlpha => {
            for ga in pixels.chunks_exact(2) {
                out.extend_from_slice(&[ga[0], ga[0], ga[0], ga[1]]);
            }
        }
        png::ColorType::Grayscale => {
            for g in pixels {
                out.extend_from_slice(&[*g, *g, *g, 255]);
            }
        }
        png::ColorType::Indexed => {
            return Err(JsValue::from_str(
                "indexed PNG was not expanded by normalize_to_color8",
            ));
        }
    }
    Ok(out)
}
