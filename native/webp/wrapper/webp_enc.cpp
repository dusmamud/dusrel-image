// @dusrel/image-webp — libwebp encoder wrapper (our own glue code),
// using the advanced WebPConfig/WebPPicture API for full control.
//
//   uint8_t* dusrel_webp_encode(rgba, width, height, quality,
//                               lossless, method, alphaQuality, outSize)
// quality: 0..100 float. lossless: 0/1. method: effort 0..6.
// alphaQuality: 0..100. Output is a malloc'd buffer (caller frees).
#include <cstdint>
#include <cstdlib>
#include <cstring>

extern "C" {
#include "webp/encode.h"
}

extern "C" uint8_t* dusrel_webp_encode(const uint8_t* rgba, int width,
                                       int height, float quality, int lossless,
                                       int method, int alphaQuality,
                                       int* outSize) {
  if (!rgba || width <= 0 || height <= 0 || !outSize) return nullptr;

  WebPConfig config;
  if (!WebPConfigInit(&config)) return nullptr;
  config.quality = quality;
  config.lossless = lossless;
  config.method = method;
  config.alpha_quality = alphaQuality;
  if (!WebPValidateConfig(&config)) return nullptr;

  WebPPicture pic;
  if (!WebPPictureInit(&pic)) return nullptr;
  pic.width = width;
  pic.height = height;
  pic.use_argb = 1;
  if (!WebPPictureImportRGBA(&pic, rgba, width * 4)) {
    WebPPictureFree(&pic);
    return nullptr;
  }

  WebPMemoryWriter writer;
  WebPMemoryWriterInit(&writer);
  pic.writer = WebPMemoryWrite;
  pic.custom_ptr = &writer;

  if (!WebPEncode(&config, &pic)) {
    WebPPictureFree(&pic);
    WebPMemoryWriterClear(&writer);
    return nullptr;
  }

  auto* out = static_cast<uint8_t*>(malloc(writer.size));
  if (out) {
    memcpy(out, writer.mem, writer.size);
    *outSize = static_cast<int>(writer.size);
  }
  WebPPictureFree(&pic);
  WebPMemoryWriterClear(&writer);
  return out;
}
