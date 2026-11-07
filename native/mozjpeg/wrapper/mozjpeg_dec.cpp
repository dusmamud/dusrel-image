// @dusrel/image-jpeg — MozJPEG decoder wrapper (our own glue code).
//
//   uint8_t* dusrel_jpeg_decode(data, size, outWidth, outHeight)
// Input  : JPEG bytes. Output: malloc'd tightly packed RGBA pixels
//          (alpha = 255); dimensions written to *outWidth/*outHeight;
//          the caller frees the buffer with free(). nullptr on failure.
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
  fprintf(stderr, "mozjpeg decode error: %s\n", message);
  longjmp(mgr->setjmp_buffer, 1);
}
}  // namespace

extern "C" uint8_t* dusrel_jpeg_decode(const uint8_t* data, int size,
                                       int* outWidth, int* outHeight) {
  if (!data || size <= 0 || !outWidth || !outHeight) return nullptr;

  jpeg_decompress_struct cinfo;
  ErrorMgr jerr;
  cinfo.err = jpeg_std_error(&jerr.pub);
  jerr.pub.error_exit = errorExit;
  if (setjmp(jerr.setjmp_buffer)) {
    jpeg_destroy_decompress(&cinfo);
    return nullptr;
  }

  jpeg_create_decompress(&cinfo);
  jpeg_mem_src(&cinfo, data, static_cast<unsigned long>(size));
  jpeg_read_header(&cinfo, TRUE);
  cinfo.out_color_space = JCS_EXT_RGBA;
  jpeg_start_decompress(&cinfo);

  const int width = static_cast<int>(cinfo.output_width);
  const int height = static_cast<int>(cinfo.output_height);
  const size_t stride = static_cast<size_t>(width) * 4;
  auto* pixels = static_cast<uint8_t*>(malloc(stride * static_cast<size_t>(height)));
  if (!pixels) {
    jpeg_destroy_decompress(&cinfo);
    return nullptr;
  }
  while (cinfo.output_scanline < cinfo.output_height) {
    JSAMPROW row = pixels + cinfo.output_scanline * stride;
    jpeg_read_scanlines(&cinfo, &row, 1);
  }
  jpeg_finish_decompress(&cinfo);
  jpeg_destroy_decompress(&cinfo);

  *outWidth = width;
  *outHeight = height;
  return pixels;
}
