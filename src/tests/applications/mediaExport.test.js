import { renderHook } from "@testing-library/react";
import { useMediaExport } from "../../hooks/useMediaExport";
import { downloadBlob } from "../../hooks/mediaHelpers";

jest.mock("../../utils/gifUtils", () => ({ encodeGIF: jest.fn() }));
jest.mock("../../hooks/mediaHelpers", () => ({
  ...jest.requireActual("../../hooks/mediaHelpers"),
  downloadBlob: jest.fn(),
}));

afterEach(() => jest.restoreAllMocks());

test("PNG export reads filtered pixels even when the presentation canvas has been discarded", async () => {
  const sourceImage = {};
  const pixels = {
    width: 2,
    height: 1,
    data: new Uint8ClampedArray([131, 165, 152, 255, 251, 73, 52, 255]),
  };
  const pipeline = {
    prepareImage: jest.fn(),
    renderFrameToImageData: jest.fn().mockResolvedValue(pixels),
  };
  const putImageData = jest.fn();
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ putImageData });
  const blob = new Blob([pixels.data], { type: "image/png" });
  const toBlob = jest.spyOn(HTMLCanvasElement.prototype, "toBlob")
    .mockImplementation(function (callback) {
      expect(this.width).toBe(2);
      expect(this.height).toBe(1);
      callback(blob);
    });
  const displayCanvas = { toBlob: jest.fn() };
  const { result } = renderHook(() => useMediaExport({
    canvasRef: { current: displayCanvas },
    ensurePipeline: async () => pipeline,
    sourceRef: { current: { kind: "image", source: sourceImage } },
  }));

  await result.current.exportResult("gruvbox");

  expect(pipeline.prepareImage).toHaveBeenCalledWith(sourceImage);
  expect(pipeline.renderFrameToImageData).toHaveBeenCalledTimes(1);
  expect(putImageData).toHaveBeenCalledWith(pixels, 0, 0);
  expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith(
    "2d", { willReadFrequently: true },
  );
  expect(displayCanvas.toBlob).not.toHaveBeenCalled();
  expect(toBlob).toHaveBeenCalledTimes(1);
  expect(downloadBlob).toHaveBeenCalledWith(blob, "gruvbox.png");
});
