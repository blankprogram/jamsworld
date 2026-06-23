import { GPU_BUFFER_USAGE } from "../constants";
import { createBindGroup, dispatchCompute } from "./shared";

const DOWNSAMPLE_SHADER = `
struct Params {
  srcWidth: f32,
  srcHeight: f32,
  dstWidth: f32,
  dstHeight: f32,
};

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var srcSampler: sampler;
@group(0) @binding(2) var dstTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<uniform> params: Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.dstWidth);
  let height = u32(params.dstHeight);
  if (gid.x >= width || gid.y >= height) {
    return;
  }

  let uv = (vec2<f32>(gid.xy) + vec2<f32>(0.5)) / vec2<f32>(params.dstWidth, params.dstHeight);
  let color = textureSampleLevel(srcTex, srcSampler, uv, 0.0);
  textureStore(dstTex, vec2<i32>(gid.xy), color);
}
`;

export default class WebGPUDownsampleStage {
  constructor(device) {
    this.device = device;
    this.module = device.createShaderModule({ code: DOWNSAMPLE_SHADER });
    this.pipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module: this.module, entryPoint: "main" },
    });
    this.uniformBuffer = device.createBuffer({
      size: 16,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
    });
    this.uniformData = new Float32Array(4);
  }

  render(encoder, src, srcWidth, srcHeight, dstWidth, dstHeight, sampler, pool) {
    const output = pool.getTemp(dstWidth, dstHeight, src);
    this.uniformData[0] = srcWidth;
    this.uniformData[1] = srcHeight;
    this.uniformData[2] = dstWidth;
    this.uniformData[3] = dstHeight;
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData);
    const bindGroup = createBindGroup(this.device, this.pipeline, [
      { binding: 0, resource: src.createView() },
      { binding: 1, resource: sampler },
      { binding: 2, resource: output.createView() },
      { binding: 3, resource: { buffer: this.uniformBuffer } },
    ]);
    dispatchCompute(encoder, this.pipeline, bindGroup, dstWidth, dstHeight);
    return output;
  }

  destroy() {
    this.uniformBuffer?.destroy();
    this.uniformBuffer = null;
  }
}
