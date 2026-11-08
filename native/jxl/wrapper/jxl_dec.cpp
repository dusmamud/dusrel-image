// @dusrel/image-jxl — libjxl decoder wrapper (our own glue code),
// using the public C API (lib/include/jxl/decode.h).
//
//   uint8_t* dusrel_jxl_decode(data, size, outWidth, outHeight)
// Output: malloc'd tightly packed RGBA pixels (caller frees).
// The output buffer is always requested with 4 channels, so
// grayscale/RGB sources come back expanded to RGBA (alpha 255).
#include <cstdint>
#include <cstdlib>

extern "C" {
#include "jxl/decode.h"
#include "jxl/types.h"
}

extern "C" uint8_t* dusrel_jxl_decode(const uint8_t* data, int size, int* outWidth,
                                      int* outHeight) {
  if (!data || size <= 0 || !outWidth || !outHeight) return nullptr;

  JxlDecoder* dec = JxlDecoderCreate(nullptr);
  if (!dec) return nullptr;

  uint8_t* pixels = nullptr;
  if (JxlDecoderSubscribeEvents(dec, JXL_DEC_BASIC_INFO | JXL_DEC_FULL_IMAGE) ==
          JXL_DEC_SUCCESS &&
      JxlDecoderSetInput(dec, data, static_cast<size_t>(size)) == JXL_DEC_SUCCESS) {
    JxlDecoderCloseInput(dec);
    for (;;) {
      JxlDecoderStatus status = JxlDecoderProcessInput(dec);
      if (status == JXL_DEC_BASIC_INFO) {
        JxlBasicInfo info;
        if (JxlDecoderGetBasicInfo(dec, &info) != JXL_DEC_SUCCESS) break;
        JxlPixelFormat format{4, JXL_TYPE_UINT8, JXL_NATIVE_ENDIAN, 0};
        size_t bufferSize = 0;
        if (JxlDecoderImageOutBufferSize(dec, &format, &bufferSize) != JXL_DEC_SUCCESS ||
            bufferSize == 0) {
          break;
        }
        pixels = static_cast<uint8_t*>(malloc(bufferSize));
        if (!pixels) break;
        if (JxlDecoderSetImageOutBuffer(dec, &format, pixels, bufferSize) !=
            JXL_DEC_SUCCESS) {
          break;
        }
        *outWidth = static_cast<int>(info.xsize);
        *outHeight = static_cast<int>(info.ysize);
      } else if (status == JXL_DEC_FULL_IMAGE) {
        // pixels + dimensions are set; success.
        break;
      } else {
        // JXL_DEC_ERROR, JXL_DEC_NEED_MORE_INPUT (input is
        // complete, so this means a truncated file), or any
        // unsubscribed event: fail.
        free(pixels);
        pixels = nullptr;
        *outWidth = 0;
        *outHeight = 0;
        break;
      }
    }
    if (pixels && (*outWidth == 0 || *outHeight == 0)) {
      free(pixels);
      pixels = nullptr;
    }
  }
  JxlDecoderDestroy(dec);
  return pixels;
}
