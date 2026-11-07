# @dusrel/image-webp — reproducible libwebp WASM build.
#
# Pins: Emscripten SDK 3.1.66 (image emscripten/emsdk:3.1.66),
# libwebp v1.6.0 (webmproject/libwebp, commit 4fa219123383...).
# Non-SIMD, single-threaded artifacts (docs/WASM_BUILD.md).
FROM emscripten/emsdk:3.1.66

ARG LIBWEBP_VERSION=v1.6.0
WORKDIR /build

RUN git clone --depth 1 --branch ${LIBWEBP_VERSION} https://github.com/webmproject/libwebp.git libwebp \
  && git -C libwebp rev-parse HEAD

COPY wrapper/ wrapper/

RUN emcmake cmake -S libwebp -B libwebp-build \
      -DCMAKE_BUILD_TYPE=Release \
      -DBUILD_SHARED_LIBS=OFF \
      -DWEBP_BUILD_CWEBP=OFF \
      -DWEBP_BUILD_DWEBP=OFF \
      -DWEBP_BUILD_GIF2WEBP=OFF \
      -DWEBP_BUILD_IMG2WEBP=OFF \
      -DWEBP_BUILD_VWEBP=OFF \
      -DWEBP_BUILD_WEBPINFO=OFF \
      -DWEBP_BUILD_WEBPMUX=OFF \
      -DWEBP_BUILD_ANIM_UTILS=OFF \
      -DWEBP_BUILD_EXTRAS=OFF \
      -DWEBP_ENABLE_SIMD=OFF \
  && emmake make -C libwebp-build webp -j"$(nproc)" \
  && find libwebp-build -name "libwebp*.a" -o -name "libsharpyuv*.a" | sort

ENV EMFLAGS="-O3 -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web,worker -s ALLOW_MEMORY_GROWTH=1 -s FILESYSTEM=0 -s ASSERTIONS=0 -s EXPORTED_RUNTIME_METHODS=[\"cwrap\",\"HEAPU8\",\"HEAPU32\"]"

RUN mkdir -p /build/out \
  && WEBP_LIB=$(find libwebp-build -name "libwebp.a" | head -n 1) \
  && SHARPYUV_LIB=$(find libwebp-build -name "libsharpyuv.a" | head -n 1) \
  && echo "libs: $WEBP_LIB $SHARPYUV_LIB" \
  && em++ $EMFLAGS -I libwebp/src wrapper/webp_enc.cpp "$WEBP_LIB" "$SHARPYUV_LIB" \
       -s EXPORTED_FUNCTIONS='["_dusrel_webp_encode","_malloc","_free"]' \
       -o /build/out/webp_enc.js \
  && em++ $EMFLAGS -I libwebp/src wrapper/webp_dec.cpp "$WEBP_LIB" "$SHARPYUV_LIB" \
       -s EXPORTED_FUNCTIONS='["_dusrel_webp_decode","_malloc","_free"]' \
       -o /build/out/webp_dec.js \
  && ls -la /build/out

CMD ["sh", "-c", "cp /build/out/* /out/ && ls -la /out"]
