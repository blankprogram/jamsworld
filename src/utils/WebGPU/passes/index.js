import WebGPUInvertPass from "./InvertPass";
import WebGPUGrayscalePass from "./GrayscalePass";
import WebGPUPosterizePass from "./PosterizePass";
import WebGPUPixelSortPass from "./PixelSortPass";
import WebGPUDitherPass from "./DitherPass";
import WebGPUSharpenPass from "./SharpenPass";
import WebGPUSobelPass from "./SobelPass";
import WebGPUEmbossPass from "./EmbossPass";
import WebGPUChromaticAberrationPass from "./ChromaticAberrationPass";
import WebGPUGaussianBlurPass from "./GaussianBlurPass";
import WebGPUScalePass from "./ScalePass";
import WebGPUPalettePass from "./PalettePass";
import WebGPUBloomPass from "./BloomPass";
import WebGPUFilmGrainPass from "./FilmGrainPass";
import WebGPUVHSPass from "./VHSPass";
import WebGPUCRTPass from "./CRTPass";
import WebGPUXDoGPass from "./XDoGPass";
import WebGPUAsciiPass from "./AsciiPass";
import WebGPUMinesweeperPass from "./MinesweeperPass";
import WebGPUMinecraftPass from "./MinecraftPass";
import WebGPUQuadtreePass from "./QuadtreePass";
import WebGPUKuwaharaPass from "./KuwaharaPass";
import WebGPUMaskCompositePass from "./MaskCompositePass";
import WebGPUPerMaskPipelinePass from "./PerMaskPipelinePass";

export {
  WebGPUInvertPass,
  WebGPUGrayscalePass,
  WebGPUPosterizePass,
  WebGPUPixelSortPass,
  WebGPUDitherPass,
  WebGPUSharpenPass,
  WebGPUSobelPass,
  WebGPUEmbossPass,
  WebGPUChromaticAberrationPass,
  WebGPUGaussianBlurPass,
  WebGPUScalePass,
  WebGPUPalettePass,
  WebGPUBloomPass,
  WebGPUFilmGrainPass,
  WebGPUVHSPass,
  WebGPUCRTPass,
  WebGPUXDoGPass,
  WebGPUAsciiPass,
  WebGPUMinesweeperPass,
  WebGPUMinecraftPass,
  WebGPUQuadtreePass,
  WebGPUKuwaharaPass,
  WebGPUMaskCompositePass,
  WebGPUPerMaskPipelinePass,
};

export const WEBGPU_PASS_REGISTRY = {
  [WebGPUInvertPass.type]: WebGPUInvertPass,
  [WebGPUGrayscalePass.type]: WebGPUGrayscalePass,
  [WebGPUPosterizePass.type]: WebGPUPosterizePass,
  [WebGPUPixelSortPass.type]: WebGPUPixelSortPass,
  [WebGPUDitherPass.type]: WebGPUDitherPass,
  [WebGPUSharpenPass.type]: WebGPUSharpenPass,
  [WebGPUSobelPass.type]: WebGPUSobelPass,
  [WebGPUEmbossPass.type]: WebGPUEmbossPass,
  [WebGPUChromaticAberrationPass.type]: WebGPUChromaticAberrationPass,
  [WebGPUGaussianBlurPass.type]: WebGPUGaussianBlurPass,
  [WebGPUScalePass.type]: WebGPUScalePass,
  [WebGPUPalettePass.type]: WebGPUPalettePass,
  [WebGPUBloomPass.type]: WebGPUBloomPass,
  [WebGPUFilmGrainPass.type]: WebGPUFilmGrainPass,
  [WebGPUVHSPass.type]: WebGPUVHSPass,
  [WebGPUCRTPass.type]: WebGPUCRTPass,
  [WebGPUXDoGPass.type]: WebGPUXDoGPass,
  [WebGPUAsciiPass.type]: WebGPUAsciiPass,
  [WebGPUMinesweeperPass.type]: WebGPUMinesweeperPass,
  [WebGPUMinecraftPass.type]: WebGPUMinecraftPass,
  [WebGPUQuadtreePass.type]: WebGPUQuadtreePass,
  [WebGPUKuwaharaPass.type]: WebGPUKuwaharaPass,
};

export function getWebGPUPassClass(type) {
  return WEBGPU_PASS_REGISTRY[type] || null;
}

export function canRunFilterOnWebGPU(filter) {
  if (!filter?.enabled) return true;
  const PassClass = getWebGPUPassClass(filter.type);
  if (!PassClass) return false;
  return typeof PassClass.canRun === "function"
    ? PassClass.canRun(filter)
    : true;
}

export function canRunFiltersOnWebGPU(filters) {
  return (
    Array.isArray(filters) &&
    filters.every((filter) => canRunFilterOnWebGPU(filter))
  );
}
