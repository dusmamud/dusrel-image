# @dusrel/image-jpeg — reproducible MozJPEG WASM build.
#
# Pins: Emscripten SDK 3.1.66 (image emscripten/emsdk:3.1.66),
# MozJPEG v4.1.5 (mozilla/mozjpeg, commit 6c9f0897afa1...).
# Non-SIMD, single-threaded build (the default artifacts per
# docs/WASM_BUILD.md; SIMD/threaded variants are separate, opt-in).
FROM emscripten/emsdk:3.1.66

ARG MOZJPEG_VERSION=v4.1.5
WORKDIR /build

RUN git clone --depth 1 --branch ${MOZJPEG_VERSION} https://github.com/mozilla/mozjpeg.git mozjpeg \
  && git -C mozjpeg rev-parse HEAD

COPY wrapper/ wrapper/

# Static libjpeg (mozjpeg flavour), no executables, no TurboJPEG API,
# no SIMD (first artifact); the library target is `jpeg-static`.
RUN emcmake cmake -S mozjpeg -B mozjpeg-build \
      -DCMAKE_BUILD_TYPE=Release \
      -DENABLE_SHARED=OFF \
      -DENABLE_STATIC=ON \
      -DWITH_TURBOJPEG=OFF \
      -DWITH_SIMD=OFF \
      -DWITH_JPEG8=ON \
      -DPNG_SUPPORTED=OFF \
  && emmake make -C mozjpeg-build jpeg-static -j"$(nproc)" \
  && ls -la mozjpeg-build/libjpeg.a

ENV EMFLAGS="-O3 -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web,worker -s ALLOW_MEMORY_GROWTH=1 -s FILESYSTEM=0 -s ASSERTIONS=0 -s EXPORTED_RUNTIME_METHODS=[\"cwrap\",\"HEAPU8\",\"HEAPU32\"]"

RUN mkdir -p /build/out \
  && em++ $EMFLAGS -I mozjpeg -I mozjpeg-build wrapper/mozjpeg_enc.cpp mozjpeg-build/libjpeg.a \
       -s EXPORTED_FUNCTIONS='["_dusrel_jpeg_encode","_malloc","_free"]' \
       -o /build/out/mozjpeg_enc.js \
  && em++ $EMFLAGS -I mozjpeg -I mozjpeg-build wrapper/mozjpeg_dec.cpp mozjpeg-build/libjpeg.a \
       -s EXPORTED_FUNCTIONS='["_dusrel_jpeg_decode","_malloc","_free"]' \
       -o /build/out/mozjpeg_dec.js \
  && ls -la /build/out

CMD ["sh", "-c", "cp /build/out/* /out/ && ls -la /out"]
