// Composite shader for overlaying telemetry UI texture on top of video texture.

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var textureSampler: sampler;
@group(0) @binding(1) var baseTexture: texture_2d<f32>;
@group(0) @binding(2) var overlayTexture: texture_2d<f32>;

struct Uniforms {
  overlayOpacity: f32,
  padding0: f32,
  padding1: f32,
  padding2: f32,
};

@group(0) @binding(3) var<uniform> uniforms: Uniforms;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  const pos = array(
    vec2f(-1.0, -1.0),
    vec2f(-1.0, 1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, 1.0),
    vec2f(1.0, 1.0)
  );
  
  const uv = array(
    vec2f(0.0, 1.0),
    vec2f(0.0, 0.0),
    vec2f(1.0, 1.0),
    vec2f(1.0, 1.0),
    vec2f(0.0, 0.0),
    vec2f(1.0, 0.0)
  );
  
  var output: VertexOutput;
  output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
  output.uv = uv[vertexIndex];
  
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let base = textureSample(baseTexture, textureSampler, input.uv);
  let overlay = textureSample(overlayTexture, textureSampler, input.uv);
  let overlayAlpha = overlay.a * uniforms.overlayOpacity;

  let rgb = mix(base.rgb, overlay.rgb, overlayAlpha);
  let outAlpha = max(base.a, overlayAlpha);

  return vec4f(rgb, outAlpha);
}