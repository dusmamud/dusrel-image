# @dusrel/image-heic — reproducible libheif WASM build.
#
# Pins: Emscripten SDK 3.1.66 (image emscripten/emsdk:3.1.66),
# libheif v1.23.7 (LGPL-3.0), libde265 1.0.15 (LGPL-3.0).
# Decode-only (ADR-0008, Option A): no encoders are built, so
# the GPL x265 encoder never enters the picture; HEVC decoding
# is libde265 only. Single-threaded artifacts (ADR-0006):
# ENABLE_MULTITHREADING_SUPPORT=OFF, so the module needs no
# SharedArrayBuffer/COOP/COEP.
#
# The build follows upstream libheif's own build-emscripten.sh
# recipe — libde265 via its autotools build (the exact flags
# upstream pins), libheif via CMake with plugin loading off —
# but links OUR minimal C-API glue (wrapper/heif_dec.cpp) as
# the entry point, in the family EMFLAGS style of the other C
# codecs. libheif's archives are linked whole-archive: its
# codec registrations live in static initialisers that a
# normal link would drop. The link also needs -lembind (as
# upstream's own link does): libheif's Emscripten build
# compiles its Embind registration unit into libheif.a, and
# the whole-archive link pulls it in — the registrations are
# inert for us, our exported C functions are the only API.
FROM emscripten/emsdk:3.1.66

ARG LIBHEIF_VERSION=1.23.7
ARG LIBDE265_VERSION=1.0.15
WORKDIR /build

RUN curl -L -o libde265.tar.gz \
      "https://github.com/strukturag/libde265/releases/download/v${LIBDE265_VERSION}/libde265-${LIBDE265_VERSION}.tar.gz" \
  && tar xf libde265.tar.gz && mv "libde265-${LIBDE265_VERSION}" libde265 \
  && curl -L -o libheif.tar.gz \
      "https://github.com/strukturag/libheif/releases/download/v${LIBHEIF_VERSION}/libheif-${LIBHEIF_VERSION}.tar.gz" \
  && tar xf libheif.tar.gz && mv "libheif-${LIBHEIF_VERSION}" libheif \
  && ls libheif/examples/example.heic

COPY wrapper/ wrapper/
COPY smoke.mjs smoke.mjs

# libde265, exactly as upstream's build-emscripten.sh builds it.
RUN cd libde265 \
  && CXXFLAGS=-O3 emconfigure ./configure \
       --enable-static --disable-shared --disable-sse \
       --disable-dec265 --disable-sherlock265 \
  && emmake make -j"$(nproc)" \
  && ls -la libde265/.libs/

RUN emcmake cmake -S libheif -B libheif-build \
      -DCMAKE_BUILD_TYPE=Release \
      -DBUILD_SHARED_LIBS=OFF \
      -DBUILD_TESTING=OFF \
      -DENABLE_MULTITHREADING_SUPPORT=OFF \
      -DENABLE_PLUGIN_LOADING=OFF \
      -DWITH_GDK_PIXBUF=OFF \
      -DWITH_EXAMPLES=OFF \
      -DWITH_EXAMPLE_HEIF_THUMB=OFF \
      -DWITH_EXAMPLE_HEIF_VIEW=OFF \
      -DBUILD_DOCUMENTATION=OFF \
      -DLIBDE265_INCLUDE_DIR=/build/libde265 \
      -DLIBDE265_LIBRARY=-L/build/libde265/libde265/.libs \
  && emmake make -C libheif-build -j"$(nproc)" \
  && find libheif-build -name "*.a" | sort

ENV EMFLAGS="-O3 -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web,worker -s ALLOW_MEMORY_GROWTH=1 -s FILESYSTEM=0 -s ASSERTIONS=0 -s EXPORTED_RUNTIME_METHODS=[\"cwrap\",\"HEAPU8\",\"HEAPU32\"]"

RUN mkdir -p /build/out \
  && HEIF_AS="$(find libheif-build -name '*.a' | tr '\n' ' ')" \
  && echo "libheif archives: $HEIF_AS" \
  && em++ $EMFLAGS -I libheif/libheif/api -I libheif-build -I libheif-build/libheif \
       wrapper/heif_dec.cpp \
       -Wl,--whole-archive $HEIF_AS -Wl,--no-whole-archive \
       -L/build/libde265/libde265/.libs -lde265 -lembind \
       -s EXPORTED_FUNCTIONS='["_dusrel_heic_decode","_dusrel_heic_last_step","_malloc","_free"]' \
       -o /build/out/heic_dec.js \
  && cp libheif/examples/example.heic /build/out/fixture.heic \
  && ls -la /build/out

# Functional smoke gate (the AVIF lesson: a green build is NOT
# proof). Node here treats .js glue as CommonJS, so the smoke
# loads an .mjs copy, exactly like the other C codecs.
RUN cp /build/out/heic_dec.js /build/out/heic_dec.mjs \
  && node smoke.mjs

CMD ["sh", "-c", "cp /build/out/heic_dec.js /build/out/heic_dec.wasm /build/out/fixture.heic /out/ && ls -la /out"]
