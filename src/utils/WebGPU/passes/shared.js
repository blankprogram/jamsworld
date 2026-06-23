export const WORKGROUP_SIZE = 8;

export const PER_PIXEL_PREAMBLE = `
struct Params {
  width: f32,
  height: f32,
  value0: f32,
  value1: f32,
};

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var dstTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;
`;

export function makePerPixelShader(body) {
  return `${PER_PIXEL_PREAMBLE}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);
  if (gid.x >= width || gid.y >= height) {
    return;
  }

  let coord = vec2<i32>(gid.xy);
  let c = textureLoad(srcTex, coord, 0);
  ${body}
}
`;
}

export function createBindGroup(device, pipeline, entries) {
  return device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries,
  });
}

export function dispatchCompute(encoder, pipeline, bindGroup, width, height) {
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(
    Math.ceil(width / WORKGROUP_SIZE),
    Math.ceil(height / WORKGROUP_SIZE),
  );
  pass.end();
}
