// @dusrel/image-avif — libavif decoder wrapper (our own glue code).
//
//   uint8_t* dusrel_avif_decode(data, size, outWidth, outHeight)
// Output: malloc'd tightly packed RGBA pixels (caller frees).
#include <cstdint>
#include <cstdlib>
#include <cstring>

extern "C" {
#include "avif/avif.h"
}

extern "C" uint8_t* dusrel_avif_decode(const uint8_t* data, int size,
                                       int* outWidth, int* outHeight) {
  if (!data || size <= 0 || !outWidth || !outHeight) return nullptr;

  avifDecoder* decoder = avifDecoderCreate();
  if (!decoder) return nullptr;
  decoder->maxThreads = 1;

  uint8_t* out = nullptr;
  if (avifDecoderSetIOMemory(decoder, data, static_cast<size_t>(size)) == AVIF_RESULT_OK &&
      avifDecoderParse(decoder) == AVIF_RESULT_OK &&
      avifDecoderNextImage(decoder) == AVIF_RESULT_OK) {
    avifRGBImage rgb;
    avifRGBImageSetDefaults(&rgb, decoder->image);
    rgb.format = AVIF_RGB_FORMAT_RGBA;
    if (avifRGBImageAllocatePixels(&rgb) == AVIF_RESULT_OK &&
        avifImageYUVToRGB(decoder->image, &rgb) == AVIF_RESULT_OK) {
      const int width = static_cast<int>(rgb.width);
      const int height = static_cast<int>(rgb.height);
      const size_t stride = static_cast<size_t>(width) * 4;
      out = static_cast<uint8_t*>(malloc(stride * static_cast<size_t>(height)));
      if (out) {
        for (int y = 0; y < height; ++y) {
          memcpy(out + static_cast<size_t>(y) * stride,
                 rgb.pixels + static_cast<size_t>(y) * rgb.rowBytes, stride);
        }
        *outWidth = width;
        *outHeight = height;
      }
    }
    avifRGBImageFreePixels(&rgb);
  }

  avifDecoderDestroy(decoder);
  return out;
}
