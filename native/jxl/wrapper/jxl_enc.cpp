// @dusrel/image-jxl — libjxl encoder wrapper (our own glue code),
// using the public C API (lib/include/jxl/encode.h).
//
//   uint8_t* dusrel_jxl_encode(rgba, width, height, quality,
//                              effort, lossless, outSize)
// quality: 0..100 (mapped to a butteraugli distance by libjxl's
// own JxlEncoderDistanceFromQuality). effort: 1..10. lossless:
// 0/1 (mathematically lossless modular encoding). Output is a
// malloc'd buffer holding a bare JXL codestream (caller frees).
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <vector>

extern "C" {
#include "jxl/encode.h"
#include "jxl/types.h"
}

// Step of the most recent encode call (0 = ok/none). The smoke
// gate reads this through dusrel_jxl_last_step() so a failure
// names the exact API call that failed instead of a bare null.
static int g_last_step = 0;

extern "C" int dusrel_jxl_last_step(void) { return g_last_step; }

extern "C" uint8_t* dusrel_jxl_encode(const uint8_t* rgba, int width, int height,
                                      float quality, int effort, int lossless,
                                      int* outSize) {
  if (!rgba || width <= 0 || height <= 0 || !outSize) return nullptr;

  g_last_step = 1;
  JxlEncoder* enc = JxlEncoderCreate(nullptr);
  if (!enc) return nullptr;
  // NULL runner = libjxl's internal sequential implementation
  // (parallel_runner.h). Single-threaded by construction: no
  // std::thread pool is ever created (ADR-0006).
  JxlEncoderSetParallelRunner(enc, nullptr, nullptr);

  JxlBasicInfo info;
  JxlEncoderInitBasicInfo(&info);
  info.xsize = static_cast<uint32_t>(width);
  info.ysize = static_cast<uint32_t>(height);
  info.bits_per_sample = 8;
  info.num_color_channels = 3;
  info.num_extra_channels = 1;
  info.alpha_bits = 8;

  uint8_t* result = nullptr;
  g_last_step = 2;
  if (JxlEncoderSetBasicInfo(enc, &info) == JXL_ENC_SUCCESS) {
    g_last_step = 3;
    JxlColorEncoding color;
    JxlColorEncodingSetToSRGB(&color, JXL_FALSE);
    if (JxlEncoderSetColorEncoding(enc, &color) == JXL_ENC_SUCCESS) {
      g_last_step = 4;
      JxlEncoderFrameSettings* settings = JxlEncoderFrameSettingsCreate(enc, nullptr);
      bool ok = settings != nullptr;
      g_last_step = 5;
      if (ok && lossless) {
        ok = JxlEncoderSetFrameLossless(settings, JXL_TRUE) == JXL_ENC_SUCCESS;
      } else if (ok) {
        ok = JxlEncoderSetFrameDistance(settings,
                                        JxlEncoderDistanceFromQuality(quality)) ==
             JXL_ENC_SUCCESS;
      }
      g_last_step = 6;
      if (ok) {
        ok = JxlEncoderFrameSettingsSetOption(settings, JXL_ENC_FRAME_SETTING_EFFORT,
                                              effort) == JXL_ENC_SUCCESS;
      }
      JxlPixelFormat format{4, JXL_TYPE_UINT8, JXL_NATIVE_ENDIAN, 0};
      const size_t rgbaSize = static_cast<size_t>(width) * height * 4;
      g_last_step = 7;
      if (ok) {
        ok = JxlEncoderAddImageFrame(settings, &format, rgba, rgbaSize) == JXL_ENC_SUCCESS;
      }
      g_last_step = 8;
      if (ok) {
        JxlEncoderCloseInput(enc);
        std::vector<uint8_t> out;
        std::vector<uint8_t> chunk(65536);
        uint8_t* next = chunk.data();
        size_t avail = chunk.size();
        JxlEncoderStatus status;
        do {
          status = JxlEncoderProcessOutput(enc, &next, &avail);
          const size_t produced = chunk.size() - avail;
          out.insert(out.end(), chunk.begin(), chunk.begin() + produced);
          next = chunk.data();
          avail = chunk.size();
        } while (status == JXL_ENC_NEED_MORE_OUTPUT);
        if (status == JXL_ENC_SUCCESS && !out.empty()) {
          g_last_step = 0;
          result = static_cast<uint8_t*>(malloc(out.size()));
          if (result) {
            memcpy(result, out.data(), out.size());
            *outSize = static_cast<int>(out.size());
          }
        }
      }
    }
  }
  JxlEncoderDestroy(enc);
  return result;
}
