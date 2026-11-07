// @dusrel/image-avif — libavif encoder wrapper (our own glue code).
//
//   uint8_t* dusrel_avif_encode(rgba, width, height, quality,
//                               qualityAlpha, speed, pixelFormat, outSize)
// quality/qualityAlpha: 0..100 (libavif 1.x scale). speed: 0..10
// (10 = fastest). pixelFormat: 0 = YUV420, 1 = YUV444, 2 = YUV422.
// Output is a malloc'd buffer (caller frees). Single-threaded.
#include <cstdint>
#include <cstdlib>
#include <cstring>

extern "C" {
#include "avif/avif.h"
}

extern "C" uint8_t* dusrel_avif_encode(const uint8_t* rgba, int width,
                                       int height, int quality,
                                       int qualityAlpha, int speed,
                                       int pixelFormat, int* outSize) {
  if (!rgba || width <= 0 || height <= 0 || !outSize) return nullptr;

  avifPixelFormat format = AVIF_PIXEL_FORMAT_YUV420;
  if (pixelFormat == 1) format = AVIF_PIXEL_FORMAT_YUV444;
  if (pixelFormat == 2) format = AVIF_PIXEL_FORMAT_YUV422;

  avifImage* image = avifImageCreate(width, height, 8, format);
  if (!image) return nullptr;
  image->colorPrimaries = AVIF_COLOR_PRIMARIES_BT709;
  image->transferCharacteristics = AVIF_TRANSFER_CHARACTERISTICS_SRGB;
  image->matrixCoefficients = AVIF_MATRIX_COEFFICIENTS_BT709;

  avifRGBImage rgb;
  avifRGBImageSetDefaults(&rgb, image);
  rgb.pixels = const_cast<uint8_t*>(rgba);
  rgb.rowBytes = static_cast<uint32_t>(width) * 4;
  if (avifImageRGBToYUV(image, &rgb) != AVIF_RESULT_OK) {
    avifImageDestroy(image);
    return nullptr;
  }

  avifEncoder* encoder = avifEncoderCreate();
  if (!encoder) {
    avifImageDestroy(image);
    return nullptr;
  }
  encoder->maxThreads = 1;
  encoder->speed = speed;
  encoder->quality = quality;
  encoder->qualityAlpha = qualityAlpha;

  avifRWData output = AVIF_DATA_EMPTY;
  avifResult result = avifEncoderWrite(encoder, image, &output);
  avifEncoderDestroy(encoder);
  avifImageDestroy(image);
  if (result != AVIF_RESULT_OK || output.size == 0) {
    avifRWDataFree(&output);
    return nullptr;
  }

  auto* out = static_cast<uint8_t*>(malloc(output.size));
  if (out) {
    memcpy(out, output.data, output.size);
    *outSize = static_cast<int>(output.size);
  }
  avifRWDataFree(&output);
  return out;
}
