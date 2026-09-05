// These strings run as GLSL on the GPU. TypeScript checks the host interfaces.
export const contourVertex = `
uniform float uTime, uTravel, uBass, uCurrent, uWake, uWidth, uMotion;
uniform float uEvents[8];
varying float vEdge, vDepth, vAngle, vLayer, vWake;
void main() {
  float angle = position.x;
  float depth = mod(position.y - uTravel, 180.0);
  float phase = position.y * 0.034906585;
  float twist = phase * 2.0 + uTime * 0.035;
  float wave = sin(angle * 3.0 + twist) * 0.95 + cos(angle * 5.0 - twist) * 0.30;
  float radius = 7.4 + wave + sin(phase * 3.0) * 0.4;
  float localWake = 0.0;
  for (int i = 0; i < 8; i++) {
    float offset = depth + uTravel - uEvents[i];
    localWake = max(localWake, exp(-offset * offset * 0.20));
  }
  radius *= 1.0 + (uWidth * 0.12 - uBass * 0.09 + localWake * 0.09) * uMotion;
  radius += sin(angle * 9.0 + phase * 4.0 + uTime * 0.12) * uCurrent * 0.16 * uMotion;
  float thickness = 0.030 + 0.016 * sin(phase * 11.0) + localWake * 0.036 * uMotion;
  radius += position.z * thickness;
  float orbit = angle + sin(phase) * 0.20 + uTime * 0.016;
  vec3 p = vec3(cos(orbit) * radius, sin(orbit) * radius * 0.87, -depth - 2.0);
  p.x += sin(phase * 2.0 + uTime * 0.045) * 1.1;
  p.y += cos(phase * 3.0 + uTime * 0.025) * 0.65;
  vEdge = position.z; vDepth = depth; vAngle = orbit; vLayer = phase; vWake = localWake;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

export const contourFragment = `
uniform float uTime, uLight, uBass, uAir, uChroma;
varying float vEdge, vDepth, vAngle, vLayer, vWake;
void main() {
  vec3 fruit = vec3(0.93, 0.20, 0.40);
  vec3 pink = vec3(1.0, 0.47, 0.64);
  vec3 violet = vec3(0.65, 0.24, 0.95);
  vec3 gold = vec3(1.0, 0.69, 0.31);
  float facing = 0.5 + 0.5 * sin(vAngle * 1.4 + vLayer * 2.0 + uTime * 0.04);
  vec3 color = mix(violet, fruit, facing);
  color = mix(color, pink, pow(0.5 + 0.5 * sin(vLayer * 5.0 - vAngle), 7.0) * 0.7);
  color = mix(color, gold, pow(0.5 + 0.5 * cos(vLayer * 3.0 + vAngle * 2.0), 14.0) * 0.65);
  color = mix(color, facing > 0.5 ? fruit : violet, uChroma * 0.30);
  float filament = pow(max(0.0, 1.0 - abs(vEdge)), 0.65);
  float fade = smoothstep(0.0, 8.0, vDepth) * (1.0 - smoothstep(125.0, 180.0, vDepth));
  float ridge = 0.55 + 0.45 * pow(0.5 + 0.5 * sin(vAngle * 2.0 - vLayer), 3.0);
  float brightness = 0.66 + uLight * 0.38 + vWake * 0.65;
  color = mix(color, pink, vWake * 0.5);
  gl_FragColor = vec4(color, filament * fade * ridge * brightness);
}`;

export const moteVertex = `
uniform float uTravel, uTime, uAir, uPixelRatio, uMotion;
varying float vAlpha, vWarm;
void main() {
  float depth = mod(position.z - uTravel * 1.06, 180.0);
  vec3 p = vec3(position.xy, -depth - 2.0);
  p.x += sin(position.z + uTime * 0.1) * 0.16 * uMotion;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp((30.0 + uAir * 18.0 * uMotion) / -mv.z, 0.7, 2.4) * uPixelRatio;
  vAlpha = smoothstep(0.0, 7.0, depth) * (1.0 - smoothstep(85.0, 180.0, depth)) * (0.26 + uAir * 0.36);
  vWarm = fract(position.z * 0.78);
}`;

export const moteFragment = `
varying float vAlpha, vWarm;
void main() {
  float spot = 1.0 - smoothstep(0.10, 0.5, length(gl_PointCoord - 0.5));
  gl_FragColor = vec4(mix(vec3(0.67, 0.36, 0.95), vec3(1.0, 0.61, 0.70), vWarm), spot * vAlpha);
}`;

export const atmosphereFragment = `
uniform float uAspect, uLight, uBass;
uniform vec2 uCenter;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - uCenter) * vec2(uAspect, 1.0);
  float r = length(p);
  float haze = exp(-r * r * 6.0);
  float core = exp(-r * r * 950.0);
  float halo = exp(-pow((r - 0.065) * 19.0, 2.0));
  vec3 ink = vec3(0.068, 0.023, 0.080);
  vec3 color = ink + vec3(0.080, 0.014, 0.072) * haze;
  color += vec3(0.33, 0.035, 0.14) * halo * (0.65 + uLight * 0.25);
  color *= 1.0 - core * 0.88;
  float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453);
  color += (grain - 0.5) * 0.012;
  gl_FragColor = vec4(color, 1.0);
}`;

export const pigmentVertex = `
uniform float uTime, uTravel, uBass, uCurrent, uAir, uWake, uMotion;
attribute vec4 aSeed;
attribute vec3 aShape;
varying float vPigment, vFacet, vFade;
void main() {
  float depth = mod(aSeed.z - uTravel, 180.0);
  float voice = aShape.y < 0.5 ? uBass : (aShape.y < 1.5 ? uCurrent : uAir);
  float nearWake = exp(-pow((depth - 22.0) / 12.0, 2.0)) * uWake;
  float bounce = sin(uTime * (0.55 + aShape.y * 0.21) + aSeed.w);
  float turn = aSeed.w + uTime * (0.10 + aShape.y * 0.055);
  turn += voice * sin(aSeed.w) * 0.6 * uMotion;
  vec3 p = position;
  float polarity = sin(aSeed.w * 3.0) > 0.45 ? -0.5 : 1.0;
  p *= 1.0 + (voice * 0.40 * polarity + nearWake * 0.38) * uMotion;
  p.xy = mat2(cos(turn), -sin(turn), sin(turn), cos(turn)) * p.xy;
  p.x *= 0.72 + 0.28 * sin(uTime * 0.25 + aSeed.w);
  p += vec3(aSeed.xy, -depth - 2.0);
  p.xy += vec2(cos(aSeed.w + uTime * 0.14), bounce) * (0.23 + voice * 0.75) * uMotion;
  vPigment = aShape.x; vFacet = aShape.z;
  vFade = smoothstep(1.5, 9.0, depth) * (1.0 - smoothstep(75.0, 165.0, depth));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

export const pigmentFragment = `
uniform float uLight, uChroma;
varying float vPigment, vFacet, vFade;
void main() {
  vec3 color = vec3(0.93, 0.31, 0.44);
  if (vPigment > 0.5) color = vec3(0.65, 0.30, 0.88);
  if (vPigment > 1.5) color = vec3(1.0, 0.47, 0.57);
  if (vPigment > 2.5) color = vec3(0.88, 0.66, 0.36);
  if (vPigment > 3.5) color = vec3(0.55, 0.73, 0.64);
  if (vPigment > 4.5) color = vec3(1.0, 0.83, 0.87);
  color = mix(color, color * color * 1.2, uChroma * 0.35);
  gl_FragColor = vec4(color * vFacet * (0.86 + uLight * 0.14), vFade * 0.92);
}`;
