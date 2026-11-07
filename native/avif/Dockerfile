# @dusrel/image-avif — reproducible libavif + libaom WASM build.
#
# Pins: Emscripten SDK 3.1.66 (image emscripten/emsdk:3.1.66),
# libaom v3.12.1 (aomedia.googlesource.com/aom, commit fc5cf6a1...),
# libavif v1.4.2 (AOMediaCodec/libavif, commit c5240fc7...).
# libaom is built for the `generic` CPU target (no x86 SIMD asm),
# encode AND decode; libavif links only the AOM codec. Expect this
# build to take a while — AOM is a large codebase.
FROM emscripten/emsdk:3.1.66

ARG LIBAOM_VERSION=v3.12.1
ARG LIBAVIF_VERSION=v1.4.2
WORKDIR /build

# libavif 1.4 locates its codecs through pkg-config; the emsdk image
# does not ship it.
RUN apt-get update   && apt-get install -y --no-install-recommends pkg-config   && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch ${LIBAOM_VERSION} https://aomedia.googlesource.com/aom aom \
  && git -C aom rev-parse HEAD

RUN emcmake cmake -S aom -B aom-build \
      -DCMAKE_BUILD_TYPE=Release \
      -DCMAKE_INSTALL_PREFIX=/build/prefix \
      -DAOM_TARGET_CPU=generic \
      -DENABLE_TESTS=OFF \
      -DENABLE_EXAMPLES=OFF \
      -DENABLE_TOOLS=OFF \
      -DENABLE_DOCS=OFF \
  && emmake make -C aom-build -j"$(nproc)" \
  && emmake make -C aom-build install \
  && ls -la /build/prefix/lib /build/prefix/include/aom

RUN git clone --depth 1 --branch ${LIBAVIF_VERSION} https://github.com/AOMediaCodec/libavif.git libavif \
  && git -C libavif rev-parse HEAD

COPY wrapper/ wrapper/

ENV PKG_CONFIG_PATH=/build/prefix/lib/pkgconfig
RUN emcmake cmake -S libavif -B libavif-build \
      -DCMAKE_BUILD_TYPE=Release \
      -DCMAKE_PREFIX_PATH=/build/prefix \
      -DBUILD_SHARED_LIBS=OFF \
      -DAVIF_CODEC_AOM=SYSTEM \
      -DAVIF_LIBYUV=LOCAL \
      -DAVIF_CODEC_DAV1D=OFF \
      -DAVIF_CODEC_LIBGAV1=OFF \
      -DAVIF_CODEC_RAV1E=OFF \
      -DAVIF_CODEC_SVT=OFF \
      -DAVIF_BUILD_APPS=OFF \
      -DAVIF_BUILD_TESTS=OFF \
      -DAVIF_BUILD_EXAMPLES=OFF \
      -DAOM_INCLUDE_DIR=/build/prefix/include \
      -DAOM_LIBRARY=/build/prefix/lib/libaom.a \
  && emmake make -C libavif-build -j"$(nproc)" avif \
  && find libavif-build -name "*.a" 

ENV EMFLAGS="-O3 -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web,worker -s ALLOW_MEMORY_GROWTH=1 -s FILESYSTEM=0 -s ASSERTIONS=0 -s EXPORTED_RUNTIME_METHODS=[\"cwrap\",\"HEAPU8\",\"HEAPU32\"]"

# libavif 1.4's static artifact is libavif_internal.a, and the LOCAL
# libyuv build adds its own archive inside the same tree — link every
# archive from the build tree plus libaom as one group.
RUN mkdir -p /build/out \
  && AVIF_LIBS=$(find libavif-build -name "*.a" | tr '\n' ' ') \
  && echo "linking: $AVIF_LIBS" \
  && em++ $EMFLAGS -I libavif/include wrapper/avif_enc.cpp \
       -Wl,--start-group $AVIF_LIBS /build/prefix/lib/libaom.a -Wl,--end-group \
       -s EXPORTED_FUNCTIONS='["_dusrel_avif_encode","_malloc","_free"]' \
       -o /build/out/avif_enc.js \
  && em++ $EMFLAGS -I libavif/include wrapper/avif_dec.cpp \
       -Wl,--start-group $AVIF_LIBS /build/prefix/lib/libaom.a -Wl,--end-group \
       -s EXPORTED_FUNCTIONS='["_dusrel_avif_decode","_malloc","_free"]' \
       -o /build/out/avif_dec.js \
  && ls -la /build/out

# Functional gate: run the built modules in Node and prove a real
# encode/decode roundtrip. A hollow module (codec missing) fails here
# instead of shipping.
COPY smoke.mjs smoke.mjs
# Node 18 (bundled with emsdk) treats .js as CommonJS without a
# package.json type field, and the glue is ESM — load .mjs copies.
RUN cp out/avif_enc.js out/avif_enc.mjs \
  && cp out/avif_dec.js out/avif_dec.mjs \
  && node smoke.mjs

CMD ["sh", "-c", "cp /build/out/avif_enc.js /build/out/avif_enc.wasm /build/out/avif_dec.js /build/out/avif_dec.wasm /out/ && ls -la /out"]
