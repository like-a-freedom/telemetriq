// SDF (Signed Distance Field) generator shader
// Converts binary text images to distance fields for crisp rendering at any resolution

struct SDFParams {
  inputTextureSize: vec2f,
  outputTextureSize: vec2f,
  searchRadius: f32,
  spread: f32,
};

@group(0) @binding(0) var inputSampler: sampler;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> params: SDFParams;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  const pos = array(
    vec2f(-1.0, -1.0),
    vec2f(-1.0, 1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, 1.0),
    vec2f(1.0, 1.0)
  );
  return vec4f(pos[vertexIndex], 0.0, 1.0);
}

// Calculate distance to nearest edge (inside = positive, outside = negative)
fn signedDistance(uv: vec2f, searchRadius: f32) -> f32 {
  let texelSize = 1.0 / params.inputTextureSize;
  let centerValue = textureSample(inputTexture, inputSampler, uv).r;
  
  // Early exit for empty areas
  if (centerValue < 0.01) {
    return -searchRadius;
  }
  
  var minDistance = searchRadius;
  
  // Search in neighborhood for edge
  let searchSteps = i32(searchRadius * 2.0);
  let halfSearch = searchRadius;
  
  for (var y = -searchSteps; y <= searchSteps; y += 2) {
    for (var x = -searchSteps; x <= searchSteps; x += 2) {
      let offset = vec2f(f32(x), f32(y)) * texelSize;
      let sampleUV = uv + offset;
      
      // Skip samples outside texture
      if (sampleUV.x < 0.0 || sampleUV.x > 1.0 || sampleUV.y < 0.0 || sampleUV.y > 1.0) {
        continue;
      }
      
      let sampleValue = textureSample(inputTexture, inputSampler, sampleUV).r;
      
      // If we found a different value (edge), calculate distance
      if (abs(sampleValue - centerValue) > 0.5) {
        let distance = length(offset * params.inputTextureSize);
        if (distance < minDistance) {
          minDistance = distance;
        }
      }
    }
  }
  
  // Convert to signed distance (inside positive, outside negative)
  return centerValue > 0.5 ? minDistance : -minDistance;
}

// Convert signed distance to normalized SDF value [0, 1]
fn distanceToSDF(distance: f32, spread: f32) -> f32 {
  // Normalize: distance = 0 at edge, positive inside, negative outside
  // Convert to [0, 1] where 0.5 is the edge
  return clamp(distance / spread + 0.5, 0.0, 1.0);
}

@fragment
fn fragmentMain(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let uv = position.xy / params.outputTextureSize;
  
  // Scale UV to input texture coordinates
  let inputUV = uv * params.inputTextureSize / params.outputTextureSize;
  
  // Calculate signed distance
  let distance = signedDistance(inputUV, params.searchRadius);
  
  // Convert to SDF
  let sdfValue = distanceToSDF(distance, params.spread);
  
  // Output single channel SDF
  return vec4f(sdfValue, 0.0, 0.0, 1.0);
}

// Alternative: 8SSEDT (8-point signed sequential Euclidean distance transform)
// More accurate but computationally heavier
fn eightSsedt(uv: vec2f, radius: f32) -> f32 {
  let texelSize = 1.0 / params.inputTextureSize;
  let centerValue = textureSample(inputTexture, inputSampler, uv).r;
  
  if (centerValue < 0.01) {
    return -radius;
  }
  
  var minDistSq = radius * radius;
  
  // 8-direction search pattern (more efficient than full grid)
  let directions = array(
    vec2f(-1.0, -1.0), vec2f(0.0, -1.0), vec2f(1.0, -1.0),
    vec2f(-1.0, 0.0),                    vec2f(1.0, 0.0),
    vec2f(-1.0, 1.0),  vec2f(0.0, 1.0),  vec2f(1.0, 1.0)
  );
  
  let maxSteps = i32(radius);
  
  for (var step = 1; step <= maxSteps; step += 1) {
    for (var dirIndex = 0; dirIndex < 8; dirIndex += 1) {
      let dir = directions[dirIndex];
      let offset = dir * f32(step) * texelSize;
      let sampleUV = uv + offset;
      
      // Check bounds
      if (sampleUV.x < 0.0 || sampleUV.x > 1.0 || sampleUV.y < 0.0 || sampleUV.y > 1.0) {
        continue;
      }
      
      let sampleValue = textureSample(inputTexture, inputSampler, sampleUV).r;
      
      if (abs(sampleValue - centerValue) > 0.5) {
        let distSq = dot(offset * params.inputTextureSize, offset * params.inputTextureSize);
        if (distSq < minDistSq) {
          minDistSq = distSq;
        }
      }
    }
  }
  
  let distance = sqrt(minDistSq);
  return centerValue > 0.5 ? distance : -distance;
}

@fragment
fn fragmentMainHighQuality(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let uv = position.xy / params.outputTextureSize;
  let inputUV = uv * params.inputTextureSize / params.outputTextureSize;
  
  // Use higher quality 8SSEDT
  let distance = eightSsedt(inputUV, params.searchRadius);
  let sdfValue = distanceToSDF(distance, params.spread);
  
  return vec4f(sdfValue, 0.0, 0.0, 1.0);
}