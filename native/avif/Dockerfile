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
      -DAVIF_CODEC_AOM=ON \
      -DAVIF_LIBYUV=LOCAL \
      -DAVIF_LOCAL_AOM=OFF \
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
  && find libavif-build -name "libavif.a"

ENV EMFLAGS="-O3 -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web,worker -s ALLOW_MEMORY_GROWTH=1 -s FILESYSTEM=0 -s ASSERTIONS=0 -s EXPORTED_RUNTIME_METHODS=[\"cwrap\",\"HEAPU8\",\"HEAPU32\"]"

RUN mkdir -p /build/out \
  && AVIF_LIB=$(find libavif-build -name "libavif.a" | head -n 1) \
  && echo "libavif: $AVIF_LIB" \
  && em++ $EMFLAGS -I libavif/include wrapper/avif_enc.cpp "$AVIF_LIB" /build/prefix/lib/libaom.a \
       -s EXPORTED_FUNCTIONS='["_dusrel_avif_encode","_malloc","_free"]' \
       -o /build/out/avif_enc.js \
  && em++ $EMFLAGS -I libavif/include wrapper/avif_dec.cpp "$AVIF_LIB" /build/prefix/lib/libaom.a \
       -s EXPORTED_FUNCTIONS='["_dusrel_avif_decode","_malloc","_free"]' \
       -o /build/out/avif_dec.js \
  && ls -la /build/out

CMD ["sh", "-c", "cp /build/out/* /out/ && ls -la /out"]
