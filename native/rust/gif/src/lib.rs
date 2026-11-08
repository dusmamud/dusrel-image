//! @dusrel/image-gif — glue over the Rust `gif` crate (our own code).
//! The `gif` crate replaced gifsicle (GPL-2.0) by decision on
//! 2026-11-07; it is MIT OR Apache-2.0 and this package stays MIT.
//!
//! dusrel_gif_encode(width, height, frames_rgba, delays_cs,
//!                   repeat, speed, global_palette) -> GIF bytes
//!   frames_rgba: all frames concatenated, each width*height*4.
//!   delays_cs:   one little-endian u16 per frame (centiseconds,
//!                the GIF format's native delay unit).
//!   repeat:      -1 = no loop block (play once), 0 = loop forever,
//!                n > 0 = loop n more times (gif.js semantics).
//!   speed:       1..30 colour-quantisation sampling (1 = best).
//!   global_palette: share the first frame's palette across all
//!                frames (nearest-colour mapping) instead of a
//!                local palette per frame.
//!
//! dusrel_gif_decode(bytes) -> framed RGBA:
//!   [width u32 LE][height u32 LE][frame count u32 LE]
//!   [repeat i32 LE: 0 forever, -1 no block, n loops]
//!   per frame: [delay_cs u16 LE][width*height*4 RGBA]
//!   Frames are composited onto a shared canvas (frame offsets
//!   honoured, keep-disposal semantics; see the package README).
use gif::{ColorOutput, DecodeOptions, DisposalMethod, Encoder, Frame, Repeat};
use wasm_bindgen::prelude::*;

fn err(e: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&e.to_string())
}

#[wasm_bindgen]
pub fn dusrel_gif_encode(
    width: u32,
    height: u32,
    frames_rgba: &[u8],
    delays_cs: &[u8],
    repeat: i32,
    speed: i32,
    global_palette: bool,
) -> Result<Vec<u8>, JsValue> {
    if width == 0 || height == 0 || width > 65535 || height > 65535 {
        return Err(JsValue::from_str(&format!(
            "GIF dimensions must be within 1..=65535, got {width}x{height}"
        )));
    }
    if !(1..=30).contains(&speed) {
        return Err(JsValue::from_str(&format!("speed must be in 1..=30, got {speed}")));
    }
    if delays_cs.len() % 2 != 0 {
        return Err(JsValue::from_str("delays_cs must be whole u16 values"));
    }
    let frame_count = delays_cs.len() / 2;
    let frame_len = (width as usize) * (height as usize) * 4;
    if frame_count == 0 || frames_rgba.len() != frame_count * frame_len {
        return Err(JsValue::from_str(&format!(
            "frames_rgba length {} does not match {frame_count} frames of {width}x{height}",
            frames_rgba.len()
        )));
    }
    let (w16, h16) = (width as u16, height as u16);

    // Quantise every frame first: the global-palette mode needs
    // frame 0's palette before any frame can be written.
    let mut quantized: Vec<Frame<'static>> = Vec::with_capacity(frame_count);
    for i in 0..frame_count {
        let mut px = frames_rgba[i * frame_len..(i + 1) * frame_len].to_vec();
        let mut frame = Frame::from_rgba_speed(w16, h16, &mut px, speed);
        frame.delay = u16::from_le_bytes([delays_cs[i * 2], delays_cs[i * 2 + 1]]);
        frame.dispose = DisposalMethod::Keep;
        quantized.push(frame);
    }

    let mut out: Vec<u8> = Vec::new();
    if global_palette && frame_count > 1 {
        let palette = quantized[0]
            .palette
            .clone()
            .ok_or_else(|| JsValue::from_str("first frame produced no palette"))?;
        let transparent = quantized[0].transparent;
        let mut encoder = Encoder::new(&mut out, w16, h16, &palette).map_err(err)?;
        set_repeat(&mut encoder, repeat)?;
        for (i, frame) in quantized.iter().enumerate() {
            let mut mapped = Frame::default();
            mapped.width = w16;
            mapped.height = h16;
            mapped.delay = frame.delay;
            mapped.dispose = DisposalMethod::Keep;
            mapped.transparent = transparent;
            if i == 0 {
                // Frame 0's indices are already in this palette.
                mapped.buffer = frame.buffer.clone();
            } else {
                mapped.buffer = std::borrow::Cow::Owned(map_to_palette(
                    &frames_rgba[i * frame_len..(i + 1) * frame_len],
                    &palette,
                    transparent,
                ));
            }
            encoder.write_frame(&mapped).map_err(err)?;
        }
    } else {
        let mut encoder = Encoder::new(&mut out, w16, h16, &[]).map_err(err)?;
        set_repeat(&mut encoder, repeat)?;
        for frame in &quantized {
            encoder.write_frame(frame).map_err(err)?;
        }
    }
    // The encoder borrows `out`; dropping it finalises the stream.
    Ok(out)
}

fn set_repeat<W: std::io::Write>(encoder: &mut Encoder<W>, repeat: i32) -> Result<(), JsValue> {
    match repeat {
        -1 => Ok(()), // no NETSCAPE block: plays once
        0 => encoder.set_repeat(Repeat::Infinite).map_err(err),
        n if n > 0 && n <= 65535 => encoder.set_repeat(Repeat::Finite(n as u16)).map_err(err),
        n if n > 65535 => encoder.set_repeat(Repeat::Finite(65535)).map_err(err),
        other => Err(JsValue::from_str(&format!(
            "repeat must be -1, 0 or a positive count, got {other}"
        ))),
    }
}

/// Maps raw RGBA pixels to palette indices by nearest RGB distance.
/// Fully transparent pixels take the palette's transparent slot
/// when it has one (GIF alpha is binary; see the README).
fn map_to_palette(rgba: &[u8], palette: &[u8], transparent: Option<u8>) -> Vec<u8> {
    let colors = palette.len() / 3;
    let mut indices = Vec::with_capacity(rgba.len() / 4);
    for px in rgba.chunks_exact(4) {
        if px[3] == 0 {
            if let Some(t) = transparent {
                indices.push(t);
                continue;
            }
        }
        let (r, g, b) = (px[0] as i32, px[1] as i32, px[2] as i32);
        let mut best = 0usize;
        let mut best_distance = i32::MAX;
        for c in 0..colors {
            let dr = r - palette[c * 3] as i32;
            let dg = g - palette[c * 3 + 1] as i32;
            let db = b - palette[c * 3 + 2] as i32;
            let d = dr * dr + dg * dg + db * db;
            if d < best_distance {
                best_distance = d;
                best = c;
            }
        }
        indices.push(best as u8);
    }
    indices
}

#[wasm_bindgen]
pub fn dusrel_gif_decode(data: &[u8]) -> Result<Vec<u8>, JsValue> {
    let mut options = DecodeOptions::new();
    options.set_color_output(ColorOutput::RGBA);
    let mut decoder = options.read_info(data).map_err(err)?;
    let (width, height) = (decoder.width() as usize, decoder.height() as usize);
    let repeat = match decoder.repeat() {
        Repeat::Infinite => 0,
        Repeat::Finite(0) => -1, // no NETSCAPE block was present
        Repeat::Finite(n) => n as i32,
    };

    // Composite each (possibly sub-rectangle) frame onto a shared
    // canvas with keep-disposal semantics.
    let mut canvas = vec![0u8; width * height * 4];
    let mut frames_blob: Vec<u8> = Vec::new();
    let mut frame_count: u32 = 0;
    while let Some(frame) = decoder.read_next_frame().map_err(err)? {
        let (fw, fh) = (frame.width as usize, frame.height as usize);
        let (left, top) = (frame.left as usize, frame.top as usize);
        for y in 0..fh {
            let dst_row = (top + y) * width + left;
            let src_row = y * fw;
            canvas[(dst_row * 4)..((dst_row + fw) * 4)]
                .copy_from_slice(&frame.buffer[(src_row * 4)..((src_row + fw) * 4)]);
        }
        frames_blob.extend_from_slice(&frame.delay.to_le_bytes());
        frames_blob.extend_from_slice(&canvas);
        frame_count += 1;
    }
    if frame_count == 0 {
        return Err(JsValue::from_str("no frames decoded (not a GIF?)"));
    }

    let mut out = Vec::with_capacity(16 + frames_blob.len());
    out.extend_from_slice(&(width as u32).to_le_bytes());
    out.extend_from_slice(&(height as u32).to_le_bytes());
    out.extend_from_slice(&frame_count.to_le_bytes());
    out.extend_from_slice(&repeat.to_le_bytes());
    out.extend_from_slice(&frames_blob);
    Ok(out)
}
