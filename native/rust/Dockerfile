# Rust codec pipeline for the @dusrel Rust family (png first).
# Pins: rust 1.99.1 (slim-bookworm), wasm-bindgen CLI 0.2.130
# (must exactly match the wasm-bindgen crate version in Cargo.toml).
# One image builds one codec (build-arg CODEC), gated by that
# codec's Node smoke test before artifacts leave the build.
FROM rust:1.99.1-slim-bookworm

ARG CODEC=png
ARG WASM_BINDGEN_VERSION=0.2.130
ENV CODEC=${CODEC}

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates nodejs clang lld llvm \
  && rm -rf /var/lib/apt/lists/*

RUN rustup target add wasm32-unknown-unknown

RUN curl -fsSL "https://github.com/wasm-bindgen/wasm-bindgen/releases/download/${WASM_BINDGEN_VERSION}/wasm-bindgen-${WASM_BINDGEN_VERSION}-x86_64-unknown-linux-musl.tar.gz" -o /tmp/wbg.tar.gz \
  && tar xzf /tmp/wbg.tar.gz -C /tmp \
  && install -m 755 "/tmp/wasm-bindgen-${WASM_BINDGEN_VERSION}-x86_64-unknown-linux-musl/wasm-bindgen" /usr/local/bin/wasm-bindgen \
  && wasm-bindgen --version

WORKDIR /build
COPY . .

RUN bash "scripts/build-${CODEC}.sh"

# Functional gate, same lesson as the C codecs: each codec ships
# its own scripts/smoke-<codec>.sh (Node here is 18/20, which treats
# .js glue as CommonJS — the scripts load .mjs copies).
RUN bash "scripts/smoke-${CODEC}.sh"

CMD ["sh", "-c", "cp /build/out/*.js /build/out/*.wasm /out/ && ls -la /out"]
