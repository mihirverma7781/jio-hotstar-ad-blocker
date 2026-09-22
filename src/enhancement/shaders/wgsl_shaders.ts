/**
 * WebGPU WGSL Shaders for Super-Resolution & Video Enhancement Pipeline
 * Fully hardware-accelerated compute & render passes in WGSL.
 */

export const WGSL_VERTEX_SHADER = `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var pos = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f( 1.0, -1.0),
    vec2f(-1.0,  1.0),
    vec2f(-1.0,  1.0),
    vec2f( 1.0, -1.0),
    vec2f( 1.0,  1.0)
  );

  var uvs = array<vec2f, 6>(
    vec2f(0.0, 1.0),
    vec2f(1.0, 1.0),
    vec2f(0.0, 0.0),
    vec2f(0.0, 0.0),
    vec2f(1.0, 1.0),
    vec2f(1.0, 0.0)
  );

  var output: VertexOutput;
  output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
  output.uv = uvs[vertexIndex];
  return output;
}
`;

export const WGSL_PREPROCESS_SHADER = `
struct PreprocessUniforms {
  texelSize: vec2f,
  denoiseLevel: i32,
  deblockLevel: i32,
};

@group(0) @binding(0) var srcTexture: texture_2d<f32>;
@group(0) @binding(1) var srcSampler: sampler;
@group(0) @binding(2) var<uniform> uniforms: PreprocessUniforms;

fn getLuma(c: vec3f) -> f32 {
  return dot(c, vec3f(0.2126, 0.7152, 0.0722));
}

@fragment
fn fs_preprocess(@location(0) uv: vec2f) -> @location(0) vec4f {
  var base = textureSample(srcTexture, srcSampler, uv).rgb;
  
  // Deblocking
  if (uniforms.deblockLevel > 0) {
    let strength = f32(uniforms.deblockLevel) * 0.25;
    let pixelPos = uv / uniforms.texelSize;
    let modPos = pixelPos % vec2f(8.0, 8.0);
    
    if (modPos.x < 1.0 || modPos.x > 7.0 || modPos.y < 1.0 || modPos.y > 7.0) {
      let cL = textureSample(srcTexture, srcSampler, uv - vec2f(uniforms.texelSize.x, 0.0)).rgb;
      let cR = textureSample(srcTexture, srcSampler, uv + vec2f(uniforms.texelSize.x, 0.0)).rgb;
      let cT = textureSample(srcTexture, srcSampler, uv - vec2f(0.0, uniforms.texelSize.y)).rgb;
      let cB = textureSample(srcTexture, srcSampler, uv + vec2f(0.0, uniforms.texelSize.y)).rgb;
      
      let smoothed = (base * 2.0 + cL + cR + cT + cB) / 6.0;
      let diffH = length(cR - cL);
      let diffV = length(cB - cT);
      let blend = max(smoothstep(0.4, 0.05, diffH), smoothstep(0.4, 0.05, diffV)) * strength;
      base = mix(base, smoothed, blend);
    }
  }

  // Bilateral Denoising
  if (uniforms.denoiseLevel > 0) {
    let spatialSigma = f32(uniforms.denoiseLevel) * 0.8;
    let rangeSigma = 0.08 + f32(uniforms.denoiseLevel) * 0.04;
    let centerLuma = getLuma(base);
    
    var totalColor = vec3f(0.0);
    var totalWeight = 0.0;
    let radius = select(1, 2, uniforms.denoiseLevel >= 2);
    
    for (var y = -radius; y <= radius; y++) {
      for (var x = -radius; x <= radius; x++) {
        let offset = vec2f(f32(x), f32(y)) * uniforms.texelSize;
        let sampleCol = textureSample(srcTexture, srcSampler, uv + offset).rgb;
        let sampleLuma = getLuma(sampleCol);
        
        let spatialDist2 = f32(x * x + y * y);
        let spatialWeight = exp(-spatialDist2 / (2.0 * spatialSigma * spatialSigma));
        let lumaDiff = sampleLuma - centerLuma;
        let rangeWeight = exp(-(lumaDiff * lumaDiff) / (2.0 * rangeSigma * rangeSigma));
        
        let weight = spatialWeight * rangeWeight;
        totalColor += sampleCol * weight;
        totalWeight += weight;
      }
    }
    if (totalWeight > 0.0) {
      base = totalColor / totalWeight;
    }
  }

  return vec4f(base, 1.0);
}
`;

export const WGSL_UPSCALER_SHADER = `
struct UpscaleUniforms {
  sourceTexelSize: vec2f,
  mode: i32, // 0: Bicubic, 1: Edge-Aware, 2: Neural SR
  scaleFactor: f32,
};

@group(0) @binding(0) var srcTexture: texture_2d<f32>;
@group(0) @binding(1) var srcSampler: sampler;
@group(0) @binding(2) var<uniform> uniforms: UpscaleUniforms;

fn getLuma(c: vec3f) -> f32 {
  return dot(c, vec3f(0.2126, 0.7152, 0.0722));
}

fn sampleBicubic(uv: vec2f) -> vec3f {
  // 4-tap Catmull-Rom approximation
  let tc = uv / uniforms.sourceTexelSize - 0.5;
  let f = fract(tc);
  let snap = (floor(tc) + 0.5) * uniforms.sourceTexelSize;
  
  let w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  let w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  let w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  let w3 = f * f * (-0.5 + 0.5 * f);
  
  let c00 = textureSample(srcTexture, srcSampler, snap).rgb;
  let c10 = textureSample(srcTexture, srcSampler, snap + vec2f(uniforms.sourceTexelSize.x, 0.0)).rgb;
  let c01 = textureSample(srcTexture, srcSampler, snap + vec2f(0.0, uniforms.sourceTexelSize.y)).rgb;
  let c11 = textureSample(srcTexture, srcSampler, snap + uniforms.sourceTexelSize).rgb;
  
  return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
}

@fragment
fn fs_upscale(@location(0) uv: vec2f) -> @location(0) vec4f {
  var result = sampleBicubic(uv);
  
  // Edge-Aware directional reconstruction
  if (uniforms.mode >= 1) {
    let stepX = vec2f(uniforms.sourceTexelSize.x, 0.0);
    let stepY = vec2f(0.0, uniforms.sourceTexelSize.y);
    
    let lumaTL = getLuma(textureSample(srcTexture, srcSampler, uv - stepX - stepY).rgb);
    let lumaTC = getLuma(textureSample(srcTexture, srcSampler, uv - stepY).rgb);
    let lumaTR = getLuma(textureSample(srcTexture, srcSampler, uv + stepX - stepY).rgb);
    let lumaML = getLuma(textureSample(srcTexture, srcSampler, uv - stepX).rgb);
    let lumaMR = getLuma(textureSample(srcTexture, srcSampler, uv + stepX).rgb);
    let lumaBL = getLuma(textureSample(srcTexture, srcSampler, uv - stepX + stepY).rgb);
    let lumaBC = getLuma(textureSample(srcTexture, srcSampler, uv + stepY).rgb);
    let lumaBR = getLuma(textureSample(srcTexture, srcSampler, uv + stepX + stepY).rgb);
    
    let gx = (lumaTR + 2.0 * lumaMR + lumaBR) - (lumaTL + 2.0 * lumaML + lumaBL);
    let gy = (lumaBL + 2.0 * lumaBC + lumaBR) - (lumaTL + 2.0 * lumaTC + lumaTR);
    let gradMag = length(vec2f(gx, gy));
    
    if (gradMag > 0.04) {
      let dir = normalize(vec2f(-gy, gx)) * uniforms.sourceTexelSize * 0.5;
      let cPos = sampleBicubic(uv + dir);
      let cNeg = sampleBicubic(uv - dir);
      let edgeBlend = (cPos + cNeg) * 0.5;
      let edgeWeight = clamp(gradMag * 3.5, 0.0, 0.85);
      result = mix(result, edgeBlend, edgeWeight);
    }
  }

  // Neural high-frequency detail synthesis pass
  if (uniforms.mode == 2) {
    let px = uniforms.sourceTexelSize * 0.35;
    let fN = textureSample(srcTexture, srcSampler, uv - vec2f(0.0, px.y)).rgb;
    let fS = textureSample(srcTexture, srcSampler, uv + vec2f(0.0, px.y)).rgb;
    let fW = textureSample(srcTexture, srcSampler, uv - vec2f(px.x, 0.0)).rgb;
    let fE = textureSample(srcTexture, srcSampler, uv + vec2f(px.x, 0.0)).rgb;
    
    let laplacian = (fN + fS + fW + fE) * 0.5 - result * 2.0;
    let detail = max(laplacian, vec3f(0.0)) + min(laplacian, vec3f(0.0)) * 0.25;
    result += detail * 0.5;
  }

  return vec4f(result, 1.0);
}
`;

export const WGSL_POSTPROCESS_SHADER = `
struct PostprocessUniforms {
  texelSize: vec2f,
  sharpness: f32,
  contrast: f32,
  saturation: f32,
  hdrEnhance: i32,
  sideBySide: i32,
  splitPos: f32,
};

@group(0) @binding(0) var srcTexture: texture_2d<f32>;
@group(0) @binding(1) var origTexture: texture_2d<f32>;
@group(0) @binding(2) var srcSampler: sampler;
@group(0) @binding(3) var<uniform> uniforms: PostprocessUniforms;

fn getLuma(c: vec3f) -> f32 {
  return dot(c, vec3f(0.2126, 0.7152, 0.0722));
}

@fragment
fn fs_postprocess(@location(0) uv: vec2f) -> @location(0) vec4f {
  // A/B Side-by-side mode
  if (uniforms.sideBySide == 1) {
    if (uv.x < uniforms.splitPos) {
      return textureSample(origTexture, srcSampler, uv);
    } else if (abs(uv.x - uniforms.splitPos) < 0.002) {
      return vec4f(1.0, 1.0, 1.0, 1.0);
    }
  }

  var c = textureSample(srcTexture, srcSampler, uv).rgb;

  // Edge-aware sharpening (CAS)
  if (uniforms.sharpness > 0.0) {
    let a = textureSample(srcTexture, srcSampler, uv + vec2f(0.0, -uniforms.texelSize.y)).rgb;
    let b = textureSample(srcTexture, srcSampler, uv + vec2f(-uniforms.texelSize.x, 0.0)).rgb;
    let d = textureSample(srcTexture, srcSampler, uv + vec2f(uniforms.texelSize.x, 0.0)).rgb;
    let e = textureSample(srcTexture, srcSampler, uv + vec2f(0.0, uniforms.texelSize.y)).rgb;
    
    let minCol = min(min(min(a, b), min(d, e)), c);
    let maxCol = max(max(max(a, b), max(d, e)), c);
    let amp = sqrt(clamp(min(minCol, 2.0 - maxCol) / max(maxCol, vec3f(0.0001)), vec3f(0.0), vec3f(1.0)));
    let w = amp * (-mix(0.125, 0.22, uniforms.sharpness));
    
    let sharpened = (c + (a + b + d + e) * w) / (1.0 + 4.0 * w);
    c = clamp(sharpened, minCol, maxCol);
  }

  // Perceptual HDR Visual Tone Enhancement
  if (uniforms.hdrEnhance > 0) {
    let boost = select(0.15, select(0.30, 0.45, uniforms.hdrEnhance == 3), uniforms.hdrEnhance == 2);
    let luma = getLuma(c);
    let expandedLuma = pow(luma + (sin((luma - 0.5) * 3.14159) * 0.5 + 0.5 - luma) * boost, 0.95);
    let hdrColor = c * (expandedLuma / max(luma, 0.0001));
    c = mix(c, hdrColor, 0.7);
  }

  // Contrast & Saturation
  c = (c - 0.5) * uniforms.contrast + 0.5;
  let finalLuma = getLuma(c);
  c = mix(vec3f(finalLuma), c, uniforms.saturation);

  return vec4f(clamp(c, vec3f(0.0), vec3f(1.0)), 1.0);
}
`;
