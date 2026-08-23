// Two triangles covering clip space [-1,1] on both axes — the only geometry
// AmbientBackgroundGL ever draws. Reused across effect runs (including
// WebGL context restoration) rather than reallocated.
export const FULLSCREEN_QUAD_VERTICES = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);

// No `#version` pragma: this is GLSL ES 1.00 (attribute/varying/
// gl_FragColor), which both a `webgl` and a `webgl2` context compile
// identically — that's what lets AmbientBackgroundGL request either without
// needing two shader variants.
export const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
varying vec2 vUv;

void main() {
  vUv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// Layered mesh-gradient background — ported from aut-dj-party's WebGL
// ambient background (itself modeled on Apple Music's lyrics background,
// per AMLL/Kawarp reverse-engineering): several independent "copies" of the
// same blob pattern, each at its own scale/rotation/twist, screen-blended
// on top of each other.
//
// Unlike the original, brand/base color here are UNIFORMS
// (u_brandColor/u_baseColor) rather than baked-in GLSL constants — set from
// config/venue.ts's `rgb` values in AmbientBackgroundGL.tsx, so re-skinning
// for a different DJ/venue never requires touching this shader. Still
// deliberately not tinted from the track's own album art (that's a
// separate, much subtler read that fights the brand colors) — see
// AmbientBackgroundGL's docblock.
export const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

varying vec2 vUv;
uniform float u_time;
uniform float u_speed;
uniform vec2 u_resolution;
uniform vec3 u_brandColor;
uniform vec3 u_baseColor;
// Track-change burst: u_burstTime is the u_time value at the moment of the
// most recent track change, updated via a ref/uniform write only — never
// triggers a program rebuild or new buffer, just changes what one frame's
// draw call reads.
uniform float u_burstTime;
uniform float u_burstStrength;
uniform vec2 u_burstCenter;

const float BURST_DURATION = 1.4;

// 2-octave domain warp: a coarse slow wave carries the fine fast one around
// with it, instead of one wave displacing uv on its own — breaks a smooth,
// even "resin" ripple into something closer to actual fluid motion.
vec2 warpUv(vec2 uv, float t) {
  float s1 = 0.05;
  uv.x += sin(uv.y * 2.2 + t * 0.30) * s1;
  uv.y += cos(uv.x * 2.2 + t * 0.26) * s1;
  float s2 = 0.018;
  uv.x += sin(uv.y * 5.5 - t * 0.62 + 1.7) * s2;
  uv.y += cos(uv.x * 5.5 - t * 0.55 + 0.4) * s2;
  return uv;
}

// A single spot's weight: solid (w=1) out to innerR, then falls off to 0 by
// outerR — the inner plateau plus squaring the falloff (w*w) gives a dense,
// sharply-edged cone of light instead of a gradient fading from the center.
float spotWeight(float d, float innerR, float outerR) {
  float w = 1.0 - smoothstep(innerR, outerR, d);
  return w * w;
}

// One layer's blob field: 3 control points on a shared rigid rotation
// (independent angular speed per layer, via layerSeed) plus a radial twist
// that increases with distance from the layer's own center. Only one of the
// 3 control points ever carries u_brandColor per layer — the other two are
// u_baseColor, so a "layer" reads as one moving spot, not three.
vec3 renderLayer(vec2 uv, vec2 center, float t, float layerSeed, float twistAmount, vec3 c0, vec3 c1, vec3 c2) {
  float angle = t * (0.09 + layerSeed * 0.05) + layerSeed * 6.2831853;
  float ca = cos(angle);
  float sa = sin(angle);
  vec2 centered = uv - center;
  vec2 rotated = vec2(centered.x * ca - centered.y * sa, centered.x * sa + centered.y * ca);

  float r = length(centered);
  float twist = twistAmount * r;
  float tca = cos(twist);
  float tsa = sin(twist);
  vec2 p = vec2(rotated.x * tca - rotated.y * tsa, rotated.x * tsa + rotated.y * tca) + center;

  float rx = center.x * 0.82;
  float ry = 0.62;
  vec2 pos0 = center + vec2(rx, ry) * vec2(cos(t * 0.32 + layerSeed * 1.1), sin(t * 0.27 + layerSeed * 2.3));
  float w0 = spotWeight(distance(p, pos0), 0.20, 0.46);

  vec2 pos1 = center + vec2(rx, ry) * 0.9 * vec2(cos(t * 0.24 + layerSeed * 3.7 + 2.1), sin(t * 0.36 + layerSeed * 0.9 + 0.6));
  float w1 = spotWeight(distance(p, pos1), 0.16, 0.38);

  vec2 pos2 = center + vec2(rx, ry) * 0.8 * vec2(cos(t * 0.40 + layerSeed * 5.1 + 4.0), sin(t * 0.21 + layerSeed * 1.6 + 3.1));
  float w2 = spotWeight(distance(p, pos2), 0.12, 0.30);

  vec3 colorSum = c0 * w0 + c1 * w1 + c2 * w2;
  float totalWeight = w0 + w1 + w2;
  vec3 blended = totalWeight > 0.0001 ? colorSum / totalWeight : u_baseColor;
  return mix(u_baseColor, blended, clamp(totalWeight, 0.0, 1.0));
}

vec3 screenBlend(vec3 base, vec3 layer, float opacity) {
  vec3 screened = 1.0 - (1.0 - base) * (1.0 - layer);
  return mix(base, screened, opacity);
}

// Outward radial ripple from u_burstCenter, added on top of the existing
// domain warp — a track change nudges the same blob field the ambient
// motion is already drawing, instead of a separate effect layered visually
// on top of it.
vec2 burstOffset(vec2 uv, float aspect) {
  float burstAge = u_time - u_burstTime;
  float envelope = 1.0 - smoothstep(0.0, 1.0, burstAge / BURST_DURATION);
  envelope *= step(0.0, burstAge);

  vec2 center = vec2(u_burstCenter.x * aspect, u_burstCenter.y);
  vec2 toCenter = uv - center;
  float dist = length(toCenter);
  vec2 dir = dist > 0.0001 ? toCenter / dist : vec2(0.0);

  float wave = sin(dist * 14.0 - burstAge * 30.0);
  return dir * wave * envelope * u_burstStrength * 0.06;
}

// Cheap 2D hash for the dither/grain pass below — no texture lookup, just
// arithmetic.
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float t = u_time * u_speed;

  float aspect = u_resolution.x / u_resolution.y;
  vec2 uv = vUv;
  uv.x *= aspect;
  vec2 warpedUv = warpUv(uv, t);
  warpedUv += burstOffset(uv, aspect);
  vec2 center = vec2(aspect * 0.5, 0.5);

  vec3 color = u_baseColor;

  vec3 layer0 = renderLayer(warpedUv, center, t, 0.10, 1.4, u_brandColor, u_baseColor, u_baseColor);
  color = screenBlend(color, layer0, 0.95);

  vec3 layer1 = renderLayer(warpedUv, center, t, 0.45, -2.1, u_baseColor, u_brandColor, u_baseColor);
  color = screenBlend(color, layer1, 0.8);

  vec3 layer2 = renderLayer(warpedUv, center, t, 0.72, 2.8, u_baseColor, u_baseColor, u_brandColor);
  color = screenBlend(color, layer2, 0.65);

  vec3 layer3 = renderLayer(warpedUv, center, t, 0.93, -1.1, u_brandColor, u_baseColor, u_baseColor);
  color = screenBlend(color, layer3, 0.5);

  // Conservative saturation lift — enough to keep the glow from reading as
  // washed-out gray, not enough to drift off-brand.
  float luminance = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luminance), color, 1.15);

  // Dither/grain: a large blurred gradient bands visibly on an 8-bit
  // projector output without this — a tiny per-pixel noise offset (well
  // under one 8-bit step) breaks the bands up into something the eye reads
  // as smooth instead.
  float grain = (hash(gl_FragCoord.xy) - 0.5) * (1.0 / 128.0);
  color += grain;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;
