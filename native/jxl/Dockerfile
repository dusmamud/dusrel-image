# @dusrel/image-jxl — reproducible libjxl WASM build.
#
# Pins: Emscripten SDK 3.1.66 (image emscripten/emsdk:3.1.66),
# libjxl v0.11.2 (BSD-3-Clause). Non-SIMD, single-threaded
# artifacts (docs/WASM_BUILD.md, ADR-0006): the glue never sets
# a parallel runner, so encoding/decoding runs on the calling
# thread and needs no SharedArrayBuffer/COOP/COEP.
#
# JPEGXL_BUNDLE_LIBPNG is OFF: the bundle exists for the
# tools/extras PNG file support, which a raw-pixels codec
# never uses; without the flag CMake demands the libpng
# submodule even with tools off.
#
# Only the submodules the library build needs are initialised:
# brotli (entropy coding), highway (SIMD abstraction;scalar
# build here) and skcms (the default colour management in
# v0.11, JPEGXL_ENABLE_SKCMS defaults on for little-endian).
FROM emscripten/emsdk:3.1.66

ARG LIBJXL_VERSION=v0.11.2
WORKDIR /build

RUN git clone --depth 1 --branch ${LIBJXL_VERSION} https://github.com/libjxl/libjxl.git libjxl \
  && git -C libjxl submodule update --init --depth 1 \
       third_party/brotli third_party/highway third_party/skcms \
  && git -C libjxl rev-parse HEAD

COPY wrapper/ wrapper/
COPY smoke.mjs smoke.mjs

# Deprecated-SIMD-intrinsic warnings are suppressed exactly as
# the Squoosh/jSquash build does (Highway era noise, not errors
# we can act on).
ENV CXXFLAGS="-Wno-deprecated-declarations"

RUN emcmake cmake -S libjxl -B libjxl-build \
      -DCMAKE_BUILD_TYPE=Release \
      -DBUILD_SHARED_LIBS=OFF \
      -DBUILD_TESTING=OFF \
      -DJPEGXL_ENABLE_TOOLS=OFF \
      -DJPEGXL_ENABLE_EXAMPLES=OFF \
      -DJPEGXL_ENABLE_BENCHMARK=OFF \
      -DJPEGXL_ENABLE_MANPAGE=OFF \
      -DJPEGXL_ENABLE_DOXYGEN=OFF \
      -DJPEGXL_ENABLE_OPENEXR=OFF \
      -DJPEGXL_ENABLE_JPEGLI=OFF \
      -DJPEGXL_ENABLE_SJPEG=OFF \
      -DJPEGXL_BUNDLE_LIBPNG=OFF \
  && emmake make -C libjxl-build -j"$(nproc)" \
  && find libjxl-build -name "*.a" | sort

ENV EMFLAGS="-O3 -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web,worker -s ALLOW_MEMORY_GROWTH=1 -s FILESYSTEM=0 -s ASSERTIONS=0 -s EXPORTED_RUNTIME_METHODS=[\"cwrap\",\"HEAPU8\",\"HEAPU32\"]"

# Link strategy: prefer the split encoder/decoder libraries
# when the build produced them (smaller modules), fall back to
# the combined libjxl.a. Everything is linked inside a group
# so static ordering never matters.
RUN mkdir -p /build/out \
  && COMMON="$(find libjxl-build \( -name 'libhwy.a' -o -name 'libbrotlicommon-static.a' -o -name 'libskcms.a' -o -name 'libjxl_threads.a' -o -name 'libjxl_cms.a' \) | tr '\n' ' ')" \
  && ENC_LIBS="$(find libjxl-build \( -name 'libjxl_enc.a' -o -name 'libbrotlienc-static.a' \) | tr '\n' ' ')" \
  && DEC_LIBS="$(find libjxl-build \( -name 'libjxl_dec.a' -o -name 'libbrotlidec-static.a' \) | tr '\n' ' ')" \
  && COMBINED="$(find libjxl-build -name 'libjxl.a' | tr '\n' ' ')" \
  && if [ -n "$ENC_LIBS" ] && [ -n "$DEC_LIBS" ]; then \
       ENC_ALL="$ENC_LIBS $COMMON"; DEC_ALL="$DEC_LIBS $COMMON"; \
     else \
       ENC_ALL="$COMBINED $ENC_LIBS $DEC_LIBS $COMMON"; DEC_ALL="$ENC_ALL"; \
     fi \
  && echo "enc libs: $ENC_ALL" && echo "dec libs: $DEC_ALL" \
  && em++ $EMFLAGS -I libjxl/lib/include -I libjxl-build/lib/include wrapper/jxl_enc.cpp \
       -Wl,--start-group $ENC_ALL -Wl,--end-group \
       -s EXPORTED_FUNCTIONS='["_dusrel_jxl_encode","_malloc","_free"]' \
       -o /build/out/jxl_enc.js \
  && em++ $EMFLAGS -I libjxl/lib/include -I libjxl-build/lib/include wrapper/jxl_dec.cpp \
       -Wl,--start-group $DEC_ALL -Wl,--end-group \
       -s EXPORTED_FUNCTIONS='["_dusrel_jxl_decode","_malloc","_free"]' \
       -o /build/out/jxl_dec.js \
  && ls -la /build/out

# Functional smoke gate (the AVIF lesson: a green build is NOT
# proof). Node here treats .js glue as CommonJS, so the smoke
# loads .mjs copies, exactly like the other C codecs.
RUN cp /build/out/jxl_enc.js /build/out/jxl_enc.mjs \
  && cp /build/out/jxl_dec.js /build/out/jxl_dec.mjs \
  && node smoke.mjs

CMD ["sh", "-c", "cp /build/out/jxl_enc.js /build/out/jxl_enc.wasm /build/out/jxl_dec.js /build/out/jxl_dec.wasm /out/ && ls -la /out"]
