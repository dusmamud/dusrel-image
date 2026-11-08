// Minimal decode-only glue over libheif's public C API.
//
// dusrel_heic_decode(data, size, outW, outH):
//   - decodes the file's primary image with heif_decode_image(),
//     which applies the container's geometric transformations
//     (rotation / cropping / mirroring), so the pixels come out
//     upright, as interleaved 8-bit RGBA;
//   - returns a malloc'd buffer of *outW * *outH * 4 bytes
//     (caller frees with _free), or NULL on failure, in which
//     case dusrel_heic_last_step() names the failing step:
//       1 context alloc   2 read_from_memory   3 primary handle
//       4 decode_image    5 plane/dimensions   6 output alloc
#include <cstdint>
#include <cstdlib>
#include <cstring>

#include "libheif/heif.h"

static int g_last_step = 0;

extern "C" int dusrel_heic_last_step() { return g_last_step; }

extern "C" uint8_t* dusrel_heic_decode(const uint8_t* data, int size, int* out_w, int* out_h) {
  g_last_step = 0;
  if (out_w) *out_w = 0;
  if (out_h) *out_h = 0;

  heif_context* ctx = heif_context_alloc();
  if (!ctx) {
    g_last_step = 1;
    return nullptr;
  }
  struct Guard {
    heif_context* ctx;
    heif_image_handle* handle = nullptr;
    heif_image* img = nullptr;
    ~Guard() {
      if (img) heif_image_release(img);
      if (handle) heif_image_handle_release(handle);
      if (ctx) heif_context_free(ctx);
    }
  } guard{ctx};

  if (heif_context_read_from_memory(ctx, data, static_cast<size_t>(size), nullptr).code !=
      heif_error_Ok) {
    g_last_step = 2;
    return nullptr;
  }

  if (heif_context_get_primary_image_handle(ctx, &guard.handle).code != heif_error_Ok ||
      !guard.handle) {
    g_last_step = 3;
    return nullptr;
  }

  if (heif_decode_image(guard.handle, &guard.img, heif_colorspace_RGB,
                        heif_chroma_interleaved_RGBA, nullptr)
          .code != heif_error_Ok ||
      !guard.img) {
    g_last_step = 4;
    return nullptr;
  }

  const int w = heif_image_get_width(guard.img, heif_channel_interleaved);
  const int h = heif_image_get_height(guard.img, heif_channel_interleaved);
  size_t stride = 0;
  const uint8_t* plane =
      heif_image_get_plane_readonly2(guard.img, heif_channel_interleaved, &stride);
  if (!plane || w <= 0 || h <= 0 || stride < static_cast<size_t>(w) * 4) {
    g_last_step = 5;
    return nullptr;
  }

  uint8_t* out = static_cast<uint8_t*>(std::malloc(static_cast<size_t>(w) * h * 4));
  if (!out) {
    g_last_step = 6;
    return nullptr;
  }
  for (int y = 0; y < h; y++) {
    std::memcpy(out + static_cast<size_t>(y) * w * 4, plane + static_cast<size_t>(y) * stride,
                static_cast<size_t>(w) * 4);
  }

  if (out_w) *out_w = w;
  if (out_h) *out_h = h;
  return out;
}
