import { DISPLAY_FRAGMENT_SHADER, TRACE_FRAGMENT_SHADER, VERTEX_SHADER } from "./shaders.js";

// Fixed trace resolution regardless of device pixel ratio or container size
// — this is a live path tracer, not a photo. Three of these running at once
// on a phone is the single most likely way the artefact criterion gets lost,
// so the budget stays small and fixed rather than scaling with the display.
const TRACE_WIDTH = 240;
const TRACE_HEIGHT = 180;

const REFERENCE_TOTAL_SPP = 1024;
const REFERENCE_SPP_PER_STEP = 16;
const REFERENCE_SEED = 0xabcdef01;

const MSE_INTERVAL_MS = 1000;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader compile failed: ${info}`);
  }
  return shader;
}

function linkProgram(gl, vertexSource, fragmentSource) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`program link failed: ${info}`);
  }
  return program;
}

function createAccumTexture(gl, internalFormat, width, height) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, gl.RGBA, gl.FLOAT, null);
  return texture;
}

function createPingPong(gl, internalFormat, width, height) {
  const textures = [
    createAccumTexture(gl, internalFormat, width, height),
    createAccumTexture(gl, internalFormat, width, height),
  ];
  const fbos = textures.map((texture) => {
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    return fbo;
  });
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { textures, fbos, read: 0, write: 1 };
}

function clearPingPong(gl, pingPong) {
  for (const fbo of pingPong.fbos) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, TRACE_WIDTH, TRACE_HEIGHT);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

// Detects the best renderable float format this browser supports. Chosen
// deliberately: without EXT_color_buffer_float (desktop Chrome/Firefox have
// it; some mobile browsers don't), rendering to an RGBA32F target silently
// produces a black canvas rather than an error — feature-detect and fall
// back to RGBA16F, and if neither exists, the caller shows a static notice
// instead of a broken canvas.
function detectFloatFormat(gl) {
  if (gl.getExtension("EXT_color_buffer_float")) {
    return { internalFormat: gl.RGBA32F, name: "RGBA32F" };
  }
  if (gl.getExtension("EXT_color_buffer_half_float")) {
    return { internalFormat: gl.RGBA16F, name: "RGBA16F" };
  }
  return null;
}

export class Tracer {
  constructor(canvas, { onUnsupported, onError, onStats } = {}) {
    this.canvas = canvas;
    this.onUnsupported = onUnsupported ?? (() => {});
    this.onError = onError ?? (() => {});
    this.onStats = onStats ?? (() => {});
    this.seed = 1;
    this.frameIndex = 0;
    this.running = false;
    this.rafId = null;
    this.lastMseAt = 0;
    this.referenceData = null;

    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.pause();
      this.onUnsupported("The graphics context was lost — reload to try again.");
    });
    canvas.addEventListener("webglcontextrestored", () => this.init());

    this.init();
  }

  init() {
    const gl = this.canvas.getContext("webgl2", { antialias: false, alpha: false });
    if (!gl) {
      this.onUnsupported("This browser doesn't support WebGL2.");
      return;
    }
    const format = detectFloatFormat(gl);
    if (!format) {
      this.onUnsupported("This browser can't render to a floating-point buffer, which the accumulator needs.");
      return;
    }

    this.gl = gl;
    this.format = format;
    this.canvas.width = TRACE_WIDTH;
    this.canvas.height = TRACE_HEIGHT;

    this.traceProgram = linkProgram(gl, VERTEX_SHADER, TRACE_FRAGMENT_SHADER);
    this.displayProgram = linkProgram(gl, VERTEX_SHADER, DISPLAY_FRAGMENT_SHADER);
    this.vao = gl.createVertexArray();

    this.traceUniforms = {
      prevAccum: gl.getUniformLocation(this.traceProgram, "uPrevAccum"),
      resolution: gl.getUniformLocation(this.traceProgram, "uResolution"),
      frameIndex: gl.getUniformLocation(this.traceProgram, "uFrameIndex"),
      spp: gl.getUniformLocation(this.traceProgram, "uSpp"),
      seed: gl.getUniformLocation(this.traceProgram, "uSeed"),
      sampler: gl.getUniformLocation(this.traceProgram, "uSampler"),
    };
    this.displayUniforms = {
      accum: gl.getUniformLocation(this.displayProgram, "uAccum"),
    };

    this.main = createPingPong(gl, format.internalFormat, TRACE_WIDTH, TRACE_HEIGHT);
    clearPingPong(gl, this.main);

    if (!this.referenceData) this.renderReference();
    this.start();
  }

  // One accumulation step: read `pingPong`'s current texture, add uSpp more
  // samples on top, write into the other half of the pair, then swap.
  step(pingPong, frameIndex, spp, seed) {
    const gl = this.gl;
    gl.useProgram(this.traceProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, pingPong.fbos[pingPong.write]);
    gl.viewport(0, 0, TRACE_WIDTH, TRACE_HEIGHT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, pingPong.textures[pingPong.read]);
    gl.uniform1i(this.traceUniforms.prevAccum, 0);
    gl.uniform2f(this.traceUniforms.resolution, TRACE_WIDTH, TRACE_HEIGHT);
    gl.uniform1i(this.traceUniforms.frameIndex, frameIndex);
    gl.uniform1i(this.traceUniforms.spp, spp);
    gl.uniform1ui(this.traceUniforms.seed, seed >>> 0);
    gl.uniform1i(this.traceUniforms.sampler, 0);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    [pingPong.read, pingPong.write] = [pingPong.write, pingPong.read];
  }

  // A high-spp render, done once at startup and kept as a plain Float32Array
  // (not a GPU texture — nothing after this needs it back on the GPU) so the
  // live buffer can be compared against it every second on the CPU.
  renderReference() {
    const gl = this.gl;
    const reference = createPingPong(gl, this.format.internalFormat, TRACE_WIDTH, TRACE_HEIGHT);
    clearPingPong(gl, reference);
    const steps = Math.ceil(REFERENCE_TOTAL_SPP / REFERENCE_SPP_PER_STEP);
    for (let i = 0; i < steps; i++) {
      this.step(reference, i, REFERENCE_SPP_PER_STEP, REFERENCE_SEED);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, reference.fbos[reference.read]);
    const pixels = new Float32Array(TRACE_WIDTH * TRACE_HEIGHT * 4);
    gl.readPixels(0, 0, TRACE_WIDTH, TRACE_HEIGHT, gl.RGBA, gl.FLOAT, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    for (const fbo of reference.fbos) gl.deleteFramebuffer(fbo);
    for (const texture of reference.textures) gl.deleteTexture(texture);

    this.referenceData = normalizeAccum(pixels);
  }

  computeMse() {
    if (!this.referenceData) return;
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.main.fbos[this.main.read]);
    const pixels = new Float32Array(TRACE_WIDTH * TRACE_HEIGHT * 4);
    gl.readPixels(0, 0, TRACE_WIDTH, TRACE_HEIGHT, gl.RGBA, gl.FLOAT, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const live = normalizeAccum(pixels);
    let sumSq = 0;
    for (let i = 0; i < live.length; i++) {
      const diff = live[i] - this.referenceData[i];
      sumSq += diff * diff;
    }
    this.onError(sumSq / live.length);
  }

  frame() {
    if (!this.running) return;
    this.step(this.main, this.frameIndex, 2, this.seed);
    this.frameIndex += 1;

    const gl = this.gl;
    gl.useProgram(this.displayProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.main.textures[this.main.read]);
    gl.uniform1i(this.displayUniforms.accum, 0);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const now = performance.now();
    if (now - this.lastMseAt > MSE_INTERVAL_MS) {
      this.lastMseAt = now;
      this.computeMse();
    }
    this.onStats({ frameIndex: this.frameIndex, samples: this.frameIndex * 2 });

    this.rafId = requestAnimationFrame(() => this.frame());
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastMseAt = 0;
    this.rafId = requestAnimationFrame(() => this.frame());
  }

  pause() {
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  reseed() {
    this.seed = (this.seed * 2654435761 + 1) >>> 0;
    this.frameIndex = 0;
    clearPingPong(this.gl, this.main);
  }
}

// Divides each texel's accumulated colour by its sample count, dropping the
// alpha channel — comparing normalised radiance is what MSE means here, not
// comparing raw sums at possibly-different sample counts.
function normalizeAccum(pixels) {
  const out = new Float32Array((pixels.length / 4) * 3);
  for (let i = 0, o = 0; i < pixels.length; i += 4, o += 3) {
    const count = pixels[i + 3] || 1;
    out[o] = pixels[i] / count;
    out[o + 1] = pixels[i + 1] / count;
    out[o + 2] = pixels[i + 2] / count;
  }
  return out;
}
