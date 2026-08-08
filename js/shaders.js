// GLSL can't import js/sampling.js, so the sampling formulas below are
// hand-transcribed from it — see that file's header comment for why the two
// are expected to agree, and checks/sampling.test.ts for what's actually
// tested (the JS side; there's no way to unit-test a shader directly).

export const VERTEX_SHADER = `#version 300 es
// A full-screen triangle from gl_VertexID alone — no vertex buffer needed.
const vec2 POSITIONS[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() {
  gl_Position = vec4(POSITIONS[gl_VertexID], 0.0, 1.0);
}
`;

export const TRACE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D uPrevAccum;
uniform vec2 uResolution;
uniform int uFrameIndex;
uniform int uSpp;
uniform uint uSeed;
uniform int uSampler; // 0 = uniform hemisphere (the only strategy at this stage)

out vec4 outAccum;

const float PI = 3.14159265359;
const float TWO_PI = 6.28318530718;

const vec3 SPHERE_CENTER = vec3(0.0, 1.0, 0.0);
const float SPHERE_RADIUS = 1.0;
const vec3 SPHERE_KD = vec3(0.55, 0.5, 0.45);
const float SPHERE_KS = 0.3;
const float SPHERE_N = 24.0;

const vec3 PLANE_KD = vec3(0.35, 0.36, 0.4);

const vec3 LIGHT_CENTER = vec3(1.6, 3.0, -0.6);
const vec3 LIGHT_U = vec3(1.2, 0.0, 0.0);
const vec3 LIGHT_V = vec3(0.0, 0.0, 1.2);
const vec3 LIGHT_EMISSION = vec3(9.0, 7.6, 3.0);

const vec3 ENV_RADIANCE = vec3(0.05, 0.06, 0.09);

const vec3 CAM_POS = vec3(0.0, 1.8, 5.5);
const vec3 CAM_TARGET = vec3(0.0, 0.8, 0.0);

// PCG-XSH-RR. Not fract(sin(dot(uv, vec2(12.9898,78.233))) * 43758.5453) —
// that correlates across pixels and produces visible diagonal structure
// that reads as a rendering bug, not as noise.
uint pcgHash(inout uint state) {
  state = state * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float randFloat(inout uint state) {
  return float(pcgHash(state)) / 4294967296.0;
}

// Orthonormal basis from a normal, Duff et al. 2017 ("Building an
// Orthonormal Basis, Revisited") — branchless and stable at the poles,
// unlike the naive cross-with-an-axis approach.
void basisFromNormal(vec3 n, out vec3 t, out vec3 b) {
  float s = n.z >= 0.0 ? 1.0 : -1.0;
  float a = -1.0 / (s + n.z);
  float bb = n.x * n.y * a;
  t = vec3(1.0 + s * n.x * n.x * a, s * bb, -s * n.x);
  b = vec3(bb, s + n.y * n.y * a, -n.y);
}

struct Hit {
  bool didHit;
  float t;
  vec3 point;
  vec3 normal;
  int material; // 0 = sphere, 1 = plane, 2 = light
};

bool intersectSphere(vec3 ro, vec3 rd, out float t) {
  vec3 oc = ro - SPHERE_CENTER;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - SPHERE_RADIUS * SPHERE_RADIUS;
  float disc = b * b - c;
  if (disc < 0.0) return false;
  float s = sqrt(disc);
  float t0 = -b - s;
  float t1 = -b + s;
  t = t0 > 1e-4 ? t0 : t1;
  return t > 1e-4;
}

bool intersectPlane(vec3 ro, vec3 rd, out float t) {
  if (abs(rd.y) < 1e-6) return false;
  t = -ro.y / rd.y;
  return t > 1e-4;
}

bool intersectLight(vec3 ro, vec3 rd, out float t) {
  vec3 n = normalize(cross(LIGHT_U, LIGHT_V));
  float denom = dot(n, rd);
  if (abs(denom) < 1e-6) return false;
  t = dot(LIGHT_CENTER - ro, n) / denom;
  if (t < 1e-4) return false;
  vec3 p = ro + t * rd - LIGHT_CENTER;
  float lu2 = dot(LIGHT_U, LIGHT_U);
  float lv2 = dot(LIGHT_V, LIGHT_V);
  float pu = dot(p, LIGHT_U) / lu2;
  float pv = dot(p, LIGHT_V) / lv2;
  return abs(pu) <= 0.5 && abs(pv) <= 0.5;
}

Hit intersectScene(vec3 ro, vec3 rd) {
  Hit hit;
  hit.didHit = false;
  hit.t = 1e30;

  float t;
  if (intersectSphere(ro, rd, t) && t < hit.t) {
    hit.didHit = true; hit.t = t; hit.material = 0;
  }
  if (intersectPlane(ro, rd, t) && t < hit.t) {
    hit.didHit = true; hit.t = t; hit.material = 1;
  }
  if (intersectLight(ro, rd, t) && t < hit.t) {
    hit.didHit = true; hit.t = t; hit.material = 2;
  }

  if (hit.didHit) {
    hit.point = ro + hit.t * rd;
    if (hit.material == 0) hit.normal = normalize(hit.point - SPHERE_CENTER);
    else if (hit.material == 1) hit.normal = vec3(0.0, 1.0, 0.0);
    else hit.normal = normalize(cross(LIGHT_U, LIGHT_V));
  }
  return hit;
}

// Lambertian + normalised Blinn-Phong. wiLocal/woLocal are in the frame
// where +z is the surface normal — see js/sampling.js's brdf().
vec3 brdf(vec3 wiLocal, vec3 woLocal, vec3 kd, float ks, float n) {
  vec3 diffuse = kd / PI;
  vec3 h = normalize(wiLocal + woLocal);
  float cosNH = max(h.z, 0.0);
  float specular = ks * ((n + 2.0) / TWO_PI) * pow(cosNH, n);
  return diffuse + vec3(specular);
}

vec3 sampleDirect(vec3 p, vec3 normal, vec3 wo, vec3 kd, float ks, float nExp, inout uint rng) {
  float u1 = randFloat(rng);
  float u2 = randFloat(rng);

  // Uniform-over-solid-angle: cosTheta = u2 — see js/sampling.js's
  // sampleUniformHemisphere() for the derivation this mirrors.
  float cosTheta = u2;
  float sinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));
  float phi = TWO_PI * u1;
  vec3 wiLocal = vec3(sinTheta * cos(phi), sinTheta * sin(phi), cosTheta);
  float pdf = 1.0 / TWO_PI;

  vec3 t, b;
  basisFromNormal(normal, t, b);
  vec3 wi = wiLocal.x * t + wiLocal.y * b + wiLocal.z * normal;
  vec3 woLocal = vec3(dot(wo, t), dot(wo, b), dot(wo, normal));

  vec3 shadowOrigin = p + normal * 1e-3;
  Hit shadowHit = intersectScene(shadowOrigin, wi);

  vec3 li;
  if (shadowHit.didHit && shadowHit.material == 2) {
    li = LIGHT_EMISSION;
  } else if (!shadowHit.didHit) {
    li = ENV_RADIANCE;
  } else {
    li = vec3(0.0);
  }

  float cosThetaI = wiLocal.z;
  if (cosThetaI <= 0.0) return vec3(0.0);
  return brdf(wiLocal, woLocal, kd, ks, nExp) * li * cosThetaI / pdf;
}

vec3 traceCameraRay(vec2 uv, inout uint rng) {
  vec3 forward = normalize(CAM_TARGET - CAM_POS);
  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, forward);
  float aspect = uResolution.x / uResolution.y;
  float fovScale = tan(radians(20.0));
  vec3 rd = normalize(forward + uv.x * aspect * fovScale * right + uv.y * fovScale * up);

  Hit hit = intersectScene(CAM_POS, rd);
  if (!hit.didHit) return ENV_RADIANCE;
  if (hit.material == 2) return LIGHT_EMISSION;

  vec3 kd = hit.material == 0 ? SPHERE_KD : PLANE_KD;
  float ks = hit.material == 0 ? SPHERE_KS : 0.0;
  float nExp = hit.material == 0 ? SPHERE_N : 1.0;
  vec3 wo = -rd;

  return sampleDirect(hit.point, hit.normal, wo, kd, ks, nExp, rng);
}

void main() {
  vec2 pixel = gl_FragCoord.xy;
  vec2 uv = (pixel / uResolution) * 2.0 - 1.0;
  uv.y = -uv.y;

  vec3 sum = vec3(0.0);
  for (int s = 0; s < uSpp; s++) {
    uint rng = uint(pixel.x) * 1973u + uint(pixel.y) * 9277u
      + uint(uFrameIndex) * 26699u + uint(s) * 6151u + uSeed * 101u + 1u;
    randFloat(rng); randFloat(rng); // burn a couple of rounds so nearby seeds decorrelate
    sum += traceCameraRay(uv, rng);
  }

  vec4 prev = texelFetch(uPrevAccum, ivec2(gl_FragCoord.xy), 0);
  outAccum = vec4(prev.rgb + sum, prev.a + float(uSpp));
}
`;

export const DISPLAY_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D uAccum;
out vec4 outColor;
void main() {
  vec4 accum = texelFetch(uAccum, ivec2(gl_FragCoord.xy), 0);
  vec3 color = accum.a > 0.0 ? accum.rgb / accum.a : vec3(0.0);
  color = color / (1.0 + color); // Reinhard tonemap
  color = pow(color, vec3(1.0 / 2.2));
  outColor = vec4(color, 1.0);
}
`;
