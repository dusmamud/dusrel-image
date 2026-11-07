// @dusrel/image-webp — libwebp decoder wrapper (our own glue code).
//
//   uint8_t* dusrel_webp_decode(data, size, outWidth, outHeight)
// Output: malloc'd tightly packed RGBA pixels (caller frees).
#include <cstdint>
#include <cstdlib>
#include <cstring>

extern "C" {
#include "webp/decode.h"
}

extern "C" uint8_t* dusrel_webp_decode(const uint8_t* data, int size,
                                       int* outWidth, int* outHeight) {
  if (!data || size <= 0 || !outWidth || !outHeight) return nullptr;
  int width = 0;
  int height = 0;
  uint8_t* decoded = WebPDecodeRGBA(data, static_cast<size_t>(size), &width, &height);
  if (!decoded) return nullptr;
  const size_t bytes = static_cast<size_t>(width) * static_cast<size_t>(height) * 4;
  auto* out = static_cast<uint8_t*>(malloc(bytes));
  if (out) {
    memcpy(out, decoded, bytes);
    *outWidth = width;
    *outHeight = height;
  }
  WebPFree(decoded);
  return out;
}
