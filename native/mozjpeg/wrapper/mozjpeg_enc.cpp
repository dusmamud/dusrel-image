// @dusrel/image-jpeg — MozJPEG encoder wrapper (our own glue code).
//
// Exposes one function to JavaScript:
//   uint8_t* dusrel_jpeg_encode(rgba, width, height, quality,
//                               progressive, subsample, outSize)
// Input  : tightly packed RGBA pixels (width * height * 4 bytes).
// Output : malloc'd JPEG bytes; length written to *outSize; the caller
//          frees the buffer with free(). nullptr on failure.
// subsample: 0 = 4:4:4, 1 = 4:2:2, 2 = 4:2:0.
#include <cstdint>
#include <cstdlib>
#include <cstdio>
#include <setjmp.h>

extern "C" {
#include "jpeglib.h"
}

namespace {
struct ErrorMgr {
  jpeg_error_mgr pub;
  jmp_buf setjmp_buffer;
};

void errorExit(j_common_ptr cinfo) {
  auto* mgr = reinterpret_cast<ErrorMgr*>(cinfo->err);
  char message[JMSG_LENGTH_MAX];
  mgr->pub.format_message(cinfo, message);
  fprintf(stderr, "mozjpeg encode error: %s\n", message);
  longjmp(mgr->setjmp_buffer, 1);
}
}  // namespace

extern "C" uint8_t* dusrel_jpeg_encode(const uint8_t* rgba, int width,
                                       int height, int quality,
                                       int progressive, int subsample,
                                       int* outSize) {
  if (!rgba || width <= 0 || height <= 0 || !outSize) return nullptr;
  if (quality < 1) quality = 1;
  if (quality > 100) quality = 100;

  jpeg_compress_struct cinfo;
  ErrorMgr jerr;
  cinfo.err = jpeg_std_error(&jerr.pub);
  jerr.pub.error_exit = errorExit;
  if (setjmp(jerr.setjmp_buffer)) {
    jpeg_destroy_compress(&cinfo);
    return nullptr;
  }

  jpeg_create_compress(&cinfo);
  unsigned char* outBuffer = nullptr;
  unsigned long outLength = 0;
  jpeg_mem_dest(&cinfo, &outBuffer, &outLength);

  cinfo.image_width = static_cast<JDIMENSION>(width);
  cinfo.image_height = static_cast<JDIMENSION>(height);
  cinfo.input_components = 4;
  cinfo.in_color_space = JCS_EXT_RGBA;

  jpeg_set_defaults(&cinfo);
  jpeg_set_quality(&cinfo, quality, TRUE);

  // Chroma subsampling on the luma/chroma components (Y, Cb, Cr).
  int hSamp = 1, vSamp = 1;
  if (subsample == 1) {  // 4:2:2
    hSamp = 2; vSamp = 1;
  } else if (subsample >= 2) {  // 4:2:0
    hSamp = 2; vSamp = 2;
  }
  if (cinfo.num_components >= 3) {
    cinfo.comp_info[0].h_samp_factor = hSamp;
    cinfo.comp_info[0].v_samp_factor = vSamp;
    cinfo.comp_info[1].h_samp_factor = 1;
    cinfo.comp_info[1].v_samp_factor = 1;
    cinfo.comp_info[2].h_samp_factor = 1;
    cinfo.comp_info[2].v_samp_factor = 1;
  }

  if (progressive) jpeg_simple_progression(&cinfo);

  jpeg_start_compress(&cinfo, TRUE);
  const size_t rowStride = static_cast<size_t>(width) * 4;
  while (cinfo.next_scanline < cinfo.image_height) {
    JSAMPROW row = const_cast<JSAMPROW>(rgba + cinfo.next_scanline * rowStride);
    jpeg_write_scanlines(&cinfo, &row, 1);
  }
  jpeg_finish_compress(&cinfo);
  jpeg_destroy_compress(&cinfo);

  *outSize = static_cast<int>(outLength);
  return outBuffer;
}
