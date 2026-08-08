// Shared scene-sampling math. js/shaders.js hand-transcribes these formulas
// into GLSL (a shader can't import JS), and checks/sampling.test.ts imports
// this module directly. A formula changed in one place and not the other is
// a divergence to catch by reading the diff, not something a test can see —
// this file is the one source both are supposed to agree with.

export const TWO_PI = 2 * Math.PI;

// Uniform-over-solid-angle sampling of a hemisphere whose pole is +z.
// cosTheta = u2 because dω = sinθ dθ dφ and a constant pdf of 1/2π needs
// sinθ dθ to become a uniform density: substituting ξ = cosθ does that,
// since dξ = -sinθ dθ.
export function sampleUniformHemisphere(u1, u2) {
  const cosTheta = u2;
  const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
  const phi = TWO_PI * u1;
  return {
    local: [sinTheta * Math.cos(phi), sinTheta * Math.sin(phi), cosTheta],
    pdf: 1 / TWO_PI,
  };
}

function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

// Lambertian + normalised Blinn-Phong, in a local frame where +z is the
// surface normal. wi and wo are unit vectors already in that frame.
export function brdf(wi, wo, kd, ks, n) {
  const diffuse = kd / Math.PI;
  const h = normalize([wi[0] + wo[0], wi[1] + wo[1], wi[2] + wo[2]]);
  const cosNH = Math.max(0, h[2]);
  const specular = ks * ((n + 2) / TWO_PI) * Math.pow(cosNH, n);
  return diffuse + specular;
}

// The estimator every sampler shares: f_r(ωi,ωo) · Li(ωi) · cosθi / p(ωi).
// Li is passed in rather than computed here because it depends on the scene
// — does ωi reach the light, the environment, or an occluder? — which is
// the same for every sampling strategy; only ωi and p(ωi) change between them.
export function estimate(wi, wo, kd, ks, n, li, pdf) {
  const cosTheta = wi[2];
  if (cosTheta <= 0 || pdf <= 0) return 0;
  return (brdf(wi, wo, kd, ks, n) * li * cosTheta) / pdf;
}
