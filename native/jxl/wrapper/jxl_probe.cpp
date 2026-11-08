// DIAGNOSTIC ONLY — never shipped. A parameterised encoder
// used by the smoke gate to isolate which input dimension
// makes JxlEncoderProcessOutput fail in the WASM build
// (channels / runner / mode / effort / extra-channel info).
// Linked into its own module (jxl_probe.js) that the
// Dockerfile does not copy to /out.
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <vector>

extern "C" {
#include "jxl/encode.h"
#include "jxl/thread_parallel_runner.h"
#include "jxl/types.h"
}

extern "C" uint8_t* dusrel_jxl_probe_encode(const uint8_t* pixels, int width,
                                            int height, int channels, float quality,
                                            int effort, int lossless,
                                            int use_thread_runner,
                                            int set_extra_channel_info,
                                            int* outSize, int* failStep) {
  *failStep = 1;
  JxlEncoder* enc = JxlEncoderCreate(nullptr);
  if (!enc) return nullptr;
  void* runner = nullptr;
  if (use_thread_runner) {
    runner = JxlThreadParallelRunnerCreate(
        nullptr, JxlThreadParallelRunnerDefaultNumWorkerThreads());
    if (!runner) {
      *failStep = 10;
      JxlEncoderDestroy(enc);
      return nullptr;
    }
    JxlEncoderSetParallelRunner(enc, JxlThreadParallelRunner, runner);
  } else {
    JxlEncoderSetParallelRunner(enc, nullptr, nullptr);
  }

  JxlBasicInfo info;
  JxlEncoderInitBasicInfo(&info);
  info.xsize = static_cast<uint32_t>(width);
  info.ysize = static_cast<uint32_t>(height);
  info.bits_per_sample = 8;
  info.num_color_channels = 3;
  if (channels == 4) {
    info.num_extra_channels = 1;
    info.alpha_bits = 8;
  }

  uint8_t* result = nullptr;
  *failStep = 2;
  if (JxlEncoderSetBasicInfo(enc, &info) == JXL_ENC_SUCCESS) {
    JxlColorEncoding color;
    JxlColorEncodingSetToSRGB(&color, JXL_FALSE);
    *failStep = 3;
    if (JxlEncoderSetColorEncoding(enc, &color) == JXL_ENC_SUCCESS) {
      bool ok = true;
      if (channels == 4 && set_extra_channel_info) {
        JxlExtraChannelInfo alpha;
        JxlEncoderInitExtraChannelInfo(JXL_CHANNEL_ALPHA, &alpha);
        alpha.bits_per_sample = 8;
        *failStep = 9;
        ok = JxlEncoderSetExtraChannelInfo(enc, 0, &alpha) == JXL_ENC_SUCCESS;
      }
      JxlEncoderFrameSettings* settings = JxlEncoderFrameSettingsCreate(enc, nullptr);
      if (ok) ok = settings != nullptr;
      *failStep = 5;
      if (ok && lossless) {
        ok = JxlEncoderSetFrameLossless(settings, JXL_TRUE) == JXL_ENC_SUCCESS;
      } else if (ok) {
        ok = JxlEncoderSetFrameDistance(settings,
                                        JxlEncoderDistanceFromQuality(quality)) ==
             JXL_ENC_SUCCESS;
      }
      *failStep = 6;
      if (ok) {
        ok = JxlEncoderFrameSettingsSetOption(settings, JXL_ENC_FRAME_SETTING_EFFORT,
                                              effort) == JXL_ENC_SUCCESS;
      }
      JxlPixelFormat format{static_cast<uint32_t>(channels), JXL_TYPE_UINT8,
                            JXL_NATIVE_ENDIAN, 0};
      const size_t pxSize =
          static_cast<size_t>(width) * height * static_cast<size_t>(channels);
      *failStep = 7;
      if (ok) {
        ok = JxlEncoderAddImageFrame(settings, &format, pixels, pxSize) ==
             JXL_ENC_SUCCESS;
      }
      *failStep = 8;
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
          result = static_cast<uint8_t*>(malloc(out.size()));
          if (result) {
            memcpy(result, out.data(), out.size());
            *outSize = static_cast<int>(out.size());
            *failStep = 0;
          }
        }
      }
    }
  }
  if (runner) JxlThreadParallelRunnerDestroy(runner);
  JxlEncoderDestroy(enc);
  return result;
}
