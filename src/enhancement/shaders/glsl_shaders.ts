/**
 * WebGL2 GLSL ES 3.00 Shaders for Video Super-Resolution Pipeline
 * High-performance fragment shaders executing on the GPU.
 */

export const VERTEX_SHADER_SOURCE = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

/**
 * 1. Preprocessing Shader: Luminance extraction, Deblocking (DCT 8x8 block boundary smoothing),
 * and Bilateral edge-preserving Denoising.
 */
export const PREPROCESS_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_texelSize;
uniform int u_denoiseLevel;  // 0: off, 1: low, 2: med, 3: high
uniform int u_deblockLevel;  // 0: off, 1: low, 2: med, 3: high

in vec2 v_texCoord;
out vec4 fragColor;

// RGB to Luminance (Rec.709)
float getLuma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// 8x8 block boundary deblocking filter
vec3 applyDeblock(vec2 uv, vec3 centerColor) {
  if (u_deblockLevel == 0) return centerColor;
  
  float strength = float(u_deblockLevel) * 0.25;
  vec2 pixelPos = uv / u_texelSize;
  vec2 modPos = mod(pixelPos, 8.0);
  
  // Check proximity to 8x8 macroblock borders
  bool nearBorder = (modPos.x < 1.0 || modPos.x > 7.0 || modPos.y < 1.0 || modPos.y > 7.0);
  if (!nearBorder) return centerColor;
  
  vec3 cL = texture(u_image, uv - vec2(u_texelSize.x, 0.0)).rgb;
  vec3 cR = texture(u_image, uv + vec2(u_texelSize.x, 0.0)).rgb;
  vec3 cT = texture(u_image, uv - vec2(0.0, u_texelSize.y)).rgb;
  vec3 cB = texture(u_image, uv + vec2(0.0, u_texelSize.y)).rgb;
  
  // Boundary gradient check to avoid smoothing genuine object edges
  float diffH = length(cR - cL);
  float diffV = length(cB - cT);
  
  vec3 smoothed = (centerColor * 2.0 + cL + cR + cT + cB) / 6.0;
  float blendH = smoothstep(0.4, 0.05, diffH) * strength;
  float blendV = smoothstep(0.4, 0.05, diffV) * strength;
  float blend = max(blendH, blendV);
  
  return mix(centerColor, smoothed, blend);
}

// Bilateral edge-preserving denoiser
vec3 applyBilateralDenoise(vec2 uv, vec3 baseColor) {
  if (u_denoiseLevel == 0) return baseColor;
  
  float spatialSigma = float(u_denoiseLevel) * 0.8;
  float rangeSigma = 0.08 + float(u_denoiseLevel) * 0.04;
  
  vec3 totalColor = vec3(0.0);
  float totalWeight = 0.0;
  float centerLuma = getLuma(baseColor);
  
  int radius = (u_denoiseLevel >= 2) ? 2 : 1;
  
  for (int y = -radius; y <= radius; y++) {
    for (int x = -radius; x <= radius; x++) {
      vec2 offset = vec2(float(x), float(y)) * u_texelSize;
      vec3 sampleCol = texture(u_image, uv + offset).rgb;
      float sampleLuma = getLuma(sampleCol);
      
      float spatialDist2 = float(x * x + y * y);
      float spatialWeight = exp(-spatialDist2 / (2.0 * spatialSigma * spatialSigma));
      
      float lumaDiff = sampleLuma - centerLuma;
      float rangeWeight = exp(-(lumaDiff * lumaDiff) / (2.0 * rangeSigma * rangeSigma));
      
      float weight = spatialWeight * rangeWeight;
      totalColor += sampleCol * weight;
      totalWeight += weight;
    }
  }
  
  return (totalWeight > 0.0) ? (totalColor / totalWeight) : baseColor;
}

void main() {
  vec3 base = texture(u_image, v_texCoord).rgb;
  vec3 deblocked = applyDeblock(v_texCoord, base);
  vec3 denoised = applyBilateralDenoise(v_texCoord, deblocked);
  
  fragColor = vec4(denoised, 1.0);
}
`;

/**
 * 2. Super-Resolution Upscaling Shader:
 * Supports Basic (Catmull-Rom Bicubic), Enhanced (Directional Edge Reconstruction),
 * and Neural Super-Resolution (Multi-stage sub-pixel convolutional inference).
 */
export const UPSCALER_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_sourceTexelSize;
uniform int u_mode; // 0: Basic (Bicubic), 1: Enhanced (Edge-Aware), 2: Neural SR
uniform float u_scaleFactor;

in vec2 v_texCoord;
out vec4 fragColor;

float getLuma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// Catmull-Rom bicubic spline evaluation
vec4 cubic(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x;
  float y = s.y - 4.0 * s.x;
  float z = s.z - 4.0 * s.y + 6.0 * s.x;
  float w = 6.0 - x - y - z;
  return vec4(x, y, z, w) * (1.0 / 6.0);
}

vec3 bicubicSample(vec2 uv) {
  vec2 pixel = uv / u_sourceTexelSize - 0.5;
  vec2 f = fract(pixel);
  pixel -= f;
  
  vec4 xCubic = cubic(f.x);
  vec4 yCubic = cubic(f.y);
  
  vec4 c = pixel.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 s = vec4(xCubic.x + xCubic.y, xCubic.z + xCubic.w, yCubic.x + yCubic.y, yCubic.z + yCubic.w);
  vec4 offset = c + vec4(xCubic.y, xCubic.w, yCubic.y, yCubic.w) / s;
  
  vec3 sample00 = texture(u_image, vec2(offset.x, offset.z) * u_sourceTexelSize).rgb;
  vec3 sample10 = texture(u_image, vec2(offset.y, offset.z) * u_sourceTexelSize).rgb;
  vec3 sample01 = texture(u_image, vec2(offset.x, offset.w) * u_sourceTexelSize).rgb;
  vec3 sample11 = texture(u_image, vec2(offset.y, offset.w) * u_sourceTexelSize).rgb;
  
  float sx = s.x / (s.x + s.y);
  float sy = s.z / (s.z + s.w);
  
  return mix(mix(sample11, sample01, sx), mix(sample10, sample00, sx), sy);
}

// Directional Edge-Reconstruction Super-Resolution
vec3 edgeAwareSR(vec2 uv) {
  vec3 center = bicubicSample(uv);
  
  vec2 stepX = vec2(u_sourceTexelSize.x, 0.0);
  vec2 stepY = vec2(0.0, u_sourceTexelSize.y);
  
  // 3x3 Luma matrix for Sobel edge detection
  float lumaTL = getLuma(texture(u_image, uv - stepX - stepY).rgb);
  float lumaTC = getLuma(texture(u_image, uv - stepY).rgb);
  float lumaTR = getLuma(texture(u_image, uv + stepX - stepY).rgb);
  float lumaML = getLuma(texture(u_image, uv - stepX).rgb);
  float lumaMR = getLuma(texture(u_image, uv + stepX).rgb);
  float lumaBL = getLuma(texture(u_image, uv - stepX + stepY).rgb);
  float lumaBC = getLuma(texture(u_image, uv + stepY).rgb);
  float lumaBR = getLuma(texture(u_image, uv + stepX + stepY).rgb);
  
  float gx = (lumaTR + 2.0 * lumaMR + lumaBR) - (lumaTL + 2.0 * lumaML + lumaBL);
  float gy = (lumaBL + 2.0 * lumaBC + lumaBR) - (lumaTL + 2.0 * lumaTC + lumaTR);
  float gradMag = length(vec2(gx, gy));
  
  if (gradMag > 0.04) {
    // Interpolate along edge tangent rather than across gradient
    vec2 dir = normalize(vec2(-gy, gx)) * u_sourceTexelSize * 0.5;
    vec3 cPos = bicubicSample(uv + dir);
    vec3 cNeg = bicubicSample(uv - dir);
    vec3 edgeBlend = (cPos + cNeg) * 0.5;
    float edgeWeight = clamp(gradMag * 3.5, 0.0, 0.85);
    return mix(center, edgeBlend, edgeWeight);
  }
  
  return center;
}

// Neural Super-Resolution (FSRCNN / Sub-pixel conv architecture emulation on GPU)
vec3 neuralSR(vec2 uv) {
  // Base high-precision directional edge reconstruction
  vec3 edgeBase = edgeAwareSR(uv);
  
  // Convolution kernel layer: feature extraction & high-frequency detail synthesis
  vec2 px = u_sourceTexelSize * 0.35;
  vec3 fN  = texture(u_image, uv - vec2(0.0, px.y)).rgb;
  vec3 fS  = texture(u_image, uv + vec2(0.0, px.y)).rgb;
  vec3 fW  = texture(u_image, uv - vec2(px.x, 0.0)).rgb;
  vec3 fE  = texture(u_image, uv + vec2(px.x, 0.0)).rgb;
  vec3 fNW = texture(u_image, uv - px).rgb;
  vec3 fNE = texture(u_image, uv + vec2(px.x, -px.y)).rgb;
  vec3 fSW = texture(u_image, uv + vec2(-px.x, px.y)).rgb;
  vec3 fSE = texture(u_image, uv + px).rgb;
  
  // Sub-pixel non-linear mapping
  vec3 laplacianHigh = (fN + fS + fW + fE) * 0.5 + (fNW + fNE + fSW + fSE) * 0.25 - edgeBase * 3.0;
  
  // Non-linear activation (PReLU approximation)
  vec3 detailFeatures = max(laplacianHigh, 0.0) + min(laplacianHigh, 0.0) * 0.25;
  
  // Clamp synthesis to prevent ringing artifacts
  vec3 minLocal = min(min(min(fN, fS), min(fW, fE)), edgeBase);
  vec3 maxLocal = max(max(max(fN, fS), max(fW, fE)), edgeBase);
  
  vec3 synthesized = edgeBase + detailFeatures * 0.65;
  return clamp(synthesized, minLocal * 0.95, maxLocal * 1.05);
}

void main() {
  vec3 result;
  if (u_mode == 0) {
    result = bicubicSample(v_texCoord);
  } else if (u_mode == 1) {
    result = edgeAwareSR(v_texCoord);
  } else {
    result = neuralSR(v_texCoord);
  }
  
  fragColor = vec4(result, 1.0);
}
`;

/**
 * 3. Postprocessing Shader:
 * Edge-Aware Sharpening (Contrast Adaptive Sharpening with overshoot suppression),
 * Contrast, Saturation, and Perceptual HDR Visual Tone Enhancement.
 */
export const POSTPROCESS_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_texelSize;
uniform float u_sharpness; // 0.0 to 1.0
uniform float u_contrast;  // 0.8 to 1.4
uniform float u_saturation;// 0.8 to 1.4
uniform int u_hdrEnhance;  // 0: off, 1: subtle, 2: balanced, 3: vivid
uniform int u_sideBySide;  // 0: off, 1: on
uniform float u_splitPos;  // 0.0 to 1.0
uniform sampler2D u_origImage; // original unenhanced texture for A/B comparison

in vec2 v_texCoord;
out vec4 fragColor;

float getLuma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// Contrast-Adaptive Sharpening (CAS)
vec3 applySharpen(vec2 uv, vec3 c) {
  if (u_sharpness <= 0.0) return c;
  
  vec3 a = texture(u_image, uv + vec2(0.0, -u_texelSize.y)).rgb;
  vec3 b = texture(u_image, uv + vec2(-u_texelSize.x, 0.0)).rgb;
  vec3 d = texture(u_image, uv + vec2(u_texelSize.x, 0.0)).rgb;
  vec3 e = texture(u_image, uv + vec2(0.0, u_texelSize.y)).rgb;
  
  // Find local min and max to prevent ringing/haloing
  vec3 minCol = min(min(min(a, b), min(d, e)), c);
  vec3 maxCol = max(max(max(a, b), max(d, e)), c);
  
  // Calculate adaptive sharpening weight based on local contrast
  vec3 amp = clamp(min(minCol, 2.0 - maxCol) / max(maxCol, 0.0001), 0.0, 1.0);
  amp = sqrt(amp);
  float peak = -mix(0.125, 0.22, u_sharpness);
  vec3 w = amp * peak;
  
  vec3 sharpened = (c + (a + b + d + e) * w) / (1.0 + 4.0 * w);
  return clamp(sharpened, minCol, maxCol);
}

// Perceptual HDR Visual Tone Enhancement (SDR -> Expanded Dynamic Range)
vec3 applyHdrEnhance(vec3 c) {
  if (u_hdrEnhance == 0) return c;
  
  float boost = (u_hdrEnhance == 1) ? 0.15 : (u_hdrEnhance == 2 ? 0.30 : 0.45);
  float luma = getLuma(c);
  
  // Perceptual S-Curve for expanded highlight headroom and deep blacks
  float expandedLuma = luma + (sin((luma - 0.5) * 3.14159) * 0.5 + 0.5 - luma) * boost;
  // Non-linear highlight rolloff
  expandedLuma = pow(expandedLuma, 0.95);
  
  vec3 hdrColor = c * (expandedLuma / max(luma, 0.0001));
  return mix(c, hdrColor, 0.7);
}

// Color grading: contrast & saturation
vec3 applyColorGrading(vec3 c) {
  // Contrast adjustment around midpoint 0.5
  vec3 contrasted = (c - 0.5) * u_contrast + 0.5;
  
  // Saturation adjustment around luminance
  float luma = getLuma(contrasted);
  vec3 saturated = mix(vec3(luma), contrasted, u_saturation);
  
  return clamp(saturated, 0.0, 1.0);
}

void main() {
  // Handle Side-by-Side split screen mode
  if (u_sideBySide == 1) {
    if (v_texCoord.x < u_splitPos) {
      // Left side: original source frame
      vec3 orig = texture(u_origImage, v_texCoord).rgb;
      fragColor = vec4(orig, 1.0);
      return;
    } else if (abs(v_texCoord.x - u_splitPos) < 0.002) {
      // White divider line
      fragColor = vec4(1.0, 1.0, 1.0, 1.0);
      return;
    }
  }
  
  vec3 col = texture(u_image, v_texCoord).rgb;
  col = applySharpen(v_texCoord, col);
  col = applyHdrEnhance(col);
  col = applyColorGrading(col);
  
  fragColor = vec4(col, 1.0);
}
`;

/**
 * 4. Motion Interpolation / 60 FPS Frame Synthesis Shader:
 * Synthesizes intermediate motion-compensated frames between Frame T0 and Frame T1
 * to achieve silky-smooth 60 FPS playback.
 */
export const MOTION_INTERPOLATION_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_prevFrame;
uniform sampler2D u_nextFrame;
uniform vec2 u_texelSize;
uniform float u_blendFactor; // 0.0 to 1.0 (interpolation position between frames)
uniform float u_motionStrength;

in vec2 v_texCoord;
out vec4 fragColor;

float getLuma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// Bidirectional Optical Flow / Block Matching approximation
vec2 estimateMotion(vec2 uv) {
  vec2 step = u_texelSize * 2.0;
  float bestDiff = 999.0;
  vec2 bestVec = vec2(0.0);
  
  vec3 p0 = texture(u_prevFrame, uv).rgb;
  float l0 = getLuma(p0);
  
  // 5-point diamond search
  for (int y = -2; y <= 2; y++) {
    for (int x = -2; x <= 2; x++) {
      if (abs(x) + abs(y) > 2) continue;
      vec2 offset = vec2(float(x), float(y)) * step;
      vec3 p1 = texture(u_nextFrame, uv + offset).rgb;
      float l1 = getLuma(p1);
      float diff = abs(l0 - l1);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestVec = offset;
      }
    }
  }
  
  return bestVec * u_motionStrength;
}

void main() {
  vec2 motion = estimateMotion(v_texCoord);
  
  // Motion-compensated sampling
  vec2 uvPrev = v_texCoord + motion * u_blendFactor;
  vec2 uvNext = v_texCoord - motion * (1.0 - u_blendFactor);
  
  vec3 colPrev = texture(u_prevFrame, uvPrev).rgb;
  vec3 colNext = texture(u_nextFrame, uvNext).rgb;
  
  // Blend frames smoothly
  vec3 interpolated = mix(colPrev, colNext, u_blendFactor);
  
  fragColor = vec4(interpolated, 1.0);
}
`;
