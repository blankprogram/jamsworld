import WebGPUComputePass from "../WebGPUComputePass";
import { makePerPixelShader } from "./shared";

export default class WebGPUInvertPass extends WebGPUComputePass {
  static type = "INVERT";

  constructor(device) {
    super(
      device,
      makePerPixelShader(`
  textureStore(dstTex, coord, vec4<f32>(1.0 - c.rgb, c.a));
`),
    );
  }
}
