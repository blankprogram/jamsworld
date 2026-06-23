import WebGPUComputePass from "../WebGPUComputePass";
import { makePerPixelShader } from "./shared";

export default class WebGPUGrayscalePass extends WebGPUComputePass {
  static type = "GRAYSCALE";

  constructor(device) {
    super(
      device,
      makePerPixelShader(`
  let l = dot(c.rgb, vec3<f32>(0.299, 0.587, 0.114));
  textureStore(dstTex, coord, vec4<f32>(vec3<f32>(l), c.a));
`),
    );
  }
}
