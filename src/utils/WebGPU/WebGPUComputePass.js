import { GPU_BUFFER_USAGE } from "./constants";
import { createBindGroup, dispatchCompute } from "./passes/shared";

export default class WebGPUComputePass {
  constructor(device, shader, opts = {}) {
    this.device = device;
    this.values = { ...opts };
    const label = opts.label || this.constructor.type || "WebGPUComputePass";
    this.module = device.createShaderModule({
      label: `${label} shader`,
      code: shader,
    });
    this.pipeline = device.createComputePipeline({
      label: `${label} pipeline`,
      layout: "auto",
      compute: {
        module: this.module,
        entryPoint: "main",
      },
    });
    this.uniformBuffer = device.createBuffer({
      size: 16,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
    });
    this.uniformData = new Float32Array(4);
  }

  setOption(name, value) {
    this.values[name] = value;
  }

  getUniformData(width, height) {
    this.uniformData[0] = width;
    this.uniformData[1] = height;
    this.uniformData[2] = 0;
    this.uniformData[3] = 0;
    return this.uniformData;
  }

  render(encoder, state, pool) {
    const { device } = this;
    const output = pool.getTemp(state.width, state.height, state.texture);
    device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      this.getUniformData(state.width, state.height),
    );

    const bindGroup = createBindGroup(device, this.pipeline, [
      { binding: 0, resource: state.texture.createView() },
      { binding: 1, resource: output.createView() },
      { binding: 2, resource: { buffer: this.uniformBuffer } },
    ]);

    dispatchCompute(encoder, this.pipeline, bindGroup, state.width, state.height);

    return { texture: output, width: state.width, height: state.height };
  }

  destroy() {
    this.uniformBuffer?.destroy();
    this.uniformBuffer = null;
  }
}
