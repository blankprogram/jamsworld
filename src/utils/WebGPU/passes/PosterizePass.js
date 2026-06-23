import WebGPUComputePass from "../WebGPUComputePass";
import { makePerPixelShader } from "./shared";

export default class WebGPUPosterizePass extends WebGPUComputePass {
  static type = "POSTERIZE";

  constructor(device, opts = {}) {
    super(
      device,
      makePerPixelShader(`
  let levels = max(2.0, params.value0);
  let p = floor(c.rgb * levels) / levels;
  textureStore(dstTex, coord, vec4<f32>(p, c.a));
`),
      opts,
    );
    this.levels = Math.max(2, parseInt(opts.levels, 10) || 5);
  }

  setOption(name, value) {
    if (name === "levels") {
      this.levels = Math.max(2, parseInt(value, 10) || 2);
    }
  }

  getUniformData(width, height) {
    this.uniformData[0] = width;
    this.uniformData[1] = height;
    this.uniformData[2] = this.levels;
    this.uniformData[3] = 0;
    return this.uniformData;
  }
}
