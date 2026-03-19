import React, { useCallback, useEffect, useRef, useState } from "react";
import styles from "./MaskEditor.module.css";

const MIN_SHAPE_SIZE = 0.01;
const HANDLE_SIZE = 0.012;
const HANDLE_HIT_RADIUS = 0.03;
const ERASER_SIZE_MIN = 4;
const ERASER_SIZE_MAX = 96;
const ERASER_WHEEL_STEP = 2;
const ERASER_WHEEL_STEP_FAST = 8;
const POINT_APPEND_EPSILON = 0.001;
const MIN_NORMALIZED_ERASER = 0.002;
const MIN_RESIZED_ERASER = 0.0008;
const ERASER_OVERLAY_WIDTH_BUFFER_PX = 0.75;

const makeId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const clamp01 = (value) => Math.min(Math.max(value, 0), 1);

const distance = (a, b) =>
  Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.y ?? 0) - (b.y ?? 0));

function distanceToSegment(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const ab2 = abx * abx + aby * aby;
  if (ab2 <= 1e-8) return distance(point, a);
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2));
  return Math.hypot(point.x - (a.x + abx * t), point.y - (a.y + aby * t));
}

function hitRect(segment, point) {
  return (
    point.x >= segment.x &&
    point.x <= segment.x + segment.w &&
    point.y >= segment.y &&
    point.y <= segment.y + segment.h
  );
}

function hitEllipse(segment, point) {
  const cx = segment.x + segment.w / 2;
  const cy = segment.y + segment.h / 2;
  const rx = Math.max(segment.w / 2, 1e-6);
  const ry = Math.max(segment.h / 2, 1e-6);
  const nx = (point.x - cx) / rx;
  const ny = (point.y - cy) / ry;
  return nx * nx + ny * ny <= 1;
}

function hitPolygon(segment, point) {
  const pts = segment.points || [];
  if (pts.length < 3) return false;

  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const xi = pts[i].x;
    const yi = pts[i].y;
    const xj = pts[j].x;
    const yj = pts[j].y;

    const intersects =
      (yi > point.y) !== (yj > point.y) &&
      point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 1e-8) + xi;

    if (intersects) inside = !inside;
  }

  if (inside) return true;

  // Edge hit fallback helps selection when clicking near thin outlines.
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if (distanceToSegment(point, a, b) <= 0.006) return true;
  }

  return false;
}

function hitStroke(segment, point) {
  const threshold = Math.max(0.004, segment.size / 2);
  const pts = segment.points || [];
  for (let i = 1; i < pts.length; i += 1) {
    if (distanceToSegment(point, pts[i - 1], pts[i]) <= threshold) return true;
  }
  return pts.length === 1 && distance(point, pts[0]) <= threshold;
}

const SEGMENT_HIT_TESTS = {
  rect: hitRect,
  ellipse: hitEllipse,
  polygon: hitPolygon,
  stroke: hitStroke,
};

function hitSegment(segment, point) {
  const test = SEGMENT_HIT_TESTS[segment?.type];
  return test ? test(segment, point) : false;
}

function getHitSegment(segments, point) {
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const segment = segments[i];
    if (hitSegment(segment, point)) return segment;
  }
  return null;
}

function appendPointIfNeeded(points = [], point) {
  const last = points[points.length - 1];
  if (last && distance(last, point) < POINT_APPEND_EPSILON) return points;
  return [...points, { x: point.x, y: point.y }];
}

function getPolygonBounds(points) {
  if (!points.length) return null;

  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;

  for (let i = 1; i < points.length; i += 1) {
    minX = Math.min(minX, points[i].x);
    maxX = Math.max(maxX, points[i].x);
    minY = Math.min(minY, points[i].y);
    maxY = Math.max(maxY, points[i].y);
  }

  return { minX, maxX, minY, maxY };
}

function translateEraserStrokes(strokes = [], dx, dy) {
  return strokes.map((eraserStroke) => ({
    ...eraserStroke,
    points: (eraserStroke.points || []).map((p) => ({
      x: clamp01(p.x + dx),
      y: clamp01(p.y + dy),
    })),
  }));
}

function formatPath(points = []) {
  if (!points.length) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
}

function formatPolygonPoints(points = []) {
  if (!points.length) return "";
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

const TOOL_CURSOR = {
  select: "default",
  rect: "crosshair",
  ellipse: "crosshair",
  draw: "crosshair",
  eraser: "cell",
};

const INCLUDE_STROKE = "#1f4b9a";
const EXCLUDE_STROKE = "#a63b1c";
const SELECTED_STROKE = "#f2df86";
const SHAPE_STROKE_WIDTH = 0.002;
const SHAPE_STROKE_WIDTH_SELECTED = 0.0026;
const RESIZE_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const HANDLE_CURSOR = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
};

const isBoxShape = (segment) =>
  segment && (segment.type === "rect" || segment.type === "ellipse");
const isEditableMaskShape = (segment) =>
  segment &&
  (segment.type === "rect" ||
    segment.type === "ellipse" ||
    segment.type === "polygon");

const cloneStrokePath = (stroke) => ({
  ...stroke,
  points: (stroke.points || []).map((p) => ({ x: p.x, y: p.y })),
});

const cloneEraserStrokes = (strokes = []) => strokes.map(cloneStrokePath);

function isPointInsideSegment(segment, point) {
  if (!segment || segment.type === "stroke") return false;
  return hitSegment(segment, point);
}

function getResizeHandlePoint(segment, handle) {
  const left = segment.x;
  const right = segment.x + segment.w;
  const centerX = segment.x + segment.w / 2;
  const top = segment.y;
  const bottom = segment.y + segment.h;
  const centerY = segment.y + segment.h / 2;

  switch (handle) {
    case "nw":
      return { x: left, y: top };
    case "n":
      return { x: centerX, y: top };
    case "ne":
      return { x: right, y: top };
    case "e":
      return { x: right, y: centerY };
    case "se":
      return { x: right, y: bottom };
    case "s":
      return { x: centerX, y: bottom };
    case "sw":
      return { x: left, y: bottom };
    case "w":
      return { x: left, y: centerY };
    default:
      return { x: right, y: bottom };
  }
}

function getResizeHandleAtPoint(segment, point) {
  let nearest = null;
  let nearestDistance = Infinity;

  for (const handle of RESIZE_HANDLES) {
    const handlePoint = getResizeHandlePoint(segment, handle);
    const d = distance(point, handlePoint);
    if (d <= HANDLE_HIT_RADIUS && d < nearestDistance) {
      nearest = handle;
      nearestDistance = d;
    }
  }

  return nearest;
}

function getNormalizedStrokeSize(stroke) {
  if (Number.isFinite(stroke?.size) && stroke.size > 0) return stroke.size;
  if (
    Number.isFinite(stroke?.sizePx) &&
    Number.isFinite(stroke?.sourceMaxDimension) &&
    stroke.sourceMaxDimension > 0
  ) {
    return stroke.sizePx / stroke.sourceMaxDimension;
  }
  return 0.003;
}

function getStrokeWidthPx(normalizedSize, viewSize) {
  const maxDim = Math.max(1, viewSize.width, viewSize.height);
  return Math.max(1, normalizedSize * maxDim);
}

function renderSegmentShape(segment, props = {}) {
  if (segment.type === "rect") {
    return (
      <rect
        x={segment.x}
        y={segment.y}
        width={segment.w}
        height={segment.h}
        {...props}
      />
    );
  }

  if (segment.type === "ellipse") {
    return (
      <ellipse
        cx={segment.x + segment.w / 2}
        cy={segment.y + segment.h / 2}
        rx={segment.w / 2}
        ry={segment.h / 2}
        {...props}
      />
    );
  }

  if (segment.type === "polygon") {
    return <polygon points={formatPolygonPoints(segment.points)} {...props} />;
  }

  return null;
}

function MaskEditor({
  enabled,
  showOutlines = true,
  tool,
  brushSize,
  onBrushSizeChange,
  segments,
  selectedSegmentId,
  onSegmentsChange,
  onInteractionStart,
  onInteractionEnd,
  onSelectSegment,
  className,
  enabledClassName,
}) {
  const svgRef = useRef(null);
  const interactionRef = useRef(null);
  const lastHoverPointRef = useRef(null);
  const [eraserPreview, setEraserPreview] = useState(null);
  const [viewSize, setViewSize] = useState({ width: 1, height: 1 });

  const updateSegment = useCallback(
    (segmentId, updater) => {
      onSegmentsChange((prev) =>
        prev.map((segment) =>
          segment.id === segmentId ? updater(segment) : segment,
        ),
      );
    },
    [onSegmentsChange],
  );

  const removeSegment = useCallback(
    (segmentId) => {
      onSegmentsChange((prev) =>
        prev.filter((segment) => segment.id !== segmentId),
      );
      if (selectedSegmentId === segmentId) onSelectSegment(null);
    },
    [onSegmentsChange, onSelectSegment, selectedSegmentId],
  );

  useEffect(() => {
    const element = svgRef.current;
    if (!element || typeof ResizeObserver === "undefined") return undefined;

    const updateSize = () => {
      setViewSize({
        width: Math.max(1, element.clientWidth || 1),
        height: Math.max(1, element.clientHeight || 1),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    const handleDeleteKey = (event) => {
      if (!selectedSegmentId) return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      event.preventDefault();
      removeSegment(selectedSegmentId);
    };

    window.addEventListener("keydown", handleDeleteKey);
    return () => window.removeEventListener("keydown", handleDeleteKey);
  }, [enabled, selectedSegmentId, removeSegment]);

  const getPoint = useCallback((event) => {
    const element = svgRef.current;
    if (!element) return null;
    const bounds = element.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    return {
      x: clamp01((event.clientX - bounds.left) / bounds.width),
      y: clamp01((event.clientY - bounds.top) / bounds.height),
      width: bounds.width,
      height: bounds.height,
      maxDimension: Math.max(bounds.width, bounds.height),
    };
  }, []);

  const buildEraserPreview = useCallback((point, sizePx) => {
    if (!point) return null;
    return {
      x: point.x,
      y: point.y,
      rx: Math.max(0.0012, sizePx / (2 * point.width)),
      ry: Math.max(0.0012, sizePx / (2 * point.height)),
    };
  }, []);

  const previewFromPoint = useCallback(
    (point) => {
      if (!point || !enabled || tool !== "eraser") {
        lastHoverPointRef.current = null;
        setEraserPreview(null);
        return;
      }
      lastHoverPointRef.current = point;
      setEraserPreview(buildEraserPreview(point, brushSize));
    },
    [enabled, tool, brushSize, buildEraserPreview],
  );

  const handleWheel = useCallback(
    (event) => {
      if (!enabled || tool !== "eraser" || !onBrushSizeChange) return;
      event.preventDefault();
      const direction = Math.sign(event.deltaY);
      if (!direction) return;
      const step = event.shiftKey ? ERASER_WHEEL_STEP_FAST : ERASER_WHEEL_STEP;
      const nextSize = Math.max(
        ERASER_SIZE_MIN,
        Math.min(ERASER_SIZE_MAX, brushSize - direction * step),
      );
      if (nextSize !== brushSize) {
        onBrushSizeChange(nextSize);
        const point = lastHoverPointRef.current;
        if (point) {
          setEraserPreview(buildEraserPreview(point, nextSize));
        }
      }
    },
    [enabled, tool, onBrushSizeChange, brushSize, buildEraserPreview],
  );

  const handlePointerDown = useCallback(
    (event) => {
      if (!enabled) return;

      const point = getPoint(event);
      if (!point) return;
      previewFromPoint(point);
      event.preventDefault();

      const pointerId = event.pointerId;
      svgRef.current?.setPointerCapture?.(pointerId);

      if (tool === "draw") {
        const segmentId = makeId();
        const polygon = {
          id: segmentId,
          type: "polygon",
          mode: "include",
          points: [{ x: point.x, y: point.y }],
          erasers: [],
        };

        onInteractionStart?.();
        onSegmentsChange((prev) => [...prev, polygon]);
        onSelectSegment(segmentId);
        interactionRef.current = { mode: "draw-polygon", segmentId, pointerId };
        return;
      }

      if (tool === "eraser") {
        const selectedShape = segments.find(
          (segment) =>
            segment.id === selectedSegmentId && isEditableMaskShape(segment),
        );
        const hitShape = getHitSegment(segments, point);
        const targetShape =
          selectedShape && isPointInsideSegment(selectedShape, point)
            ? selectedShape
            : isEditableMaskShape(hitShape)
              ? hitShape
              : null;

        if (!targetShape) {
          interactionRef.current = null;
          return;
        }

        const eraserStroke = {
          id: makeId(),
          size: Math.max(MIN_NORMALIZED_ERASER, brushSize / point.maxDimension),
          points: [{ x: point.x, y: point.y }],
        };

        onInteractionStart?.();
        updateSegment(targetShape.id, (segment) => ({
          ...segment,
          erasers: [...(segment.erasers || []), eraserStroke],
        }));
        onSelectSegment(targetShape.id);
        interactionRef.current = {
          mode: "erase-attached",
          segmentId: targetShape.id,
          eraserId: eraserStroke.id,
          pointerId,
        };
        return;
      }

      if (tool === "rect" || tool === "ellipse") {
        const segmentId = makeId();
        const shape = {
          id: segmentId,
          type: tool,
          mode: "include",
          x: point.x,
          y: point.y,
          w: MIN_SHAPE_SIZE,
          h: MIN_SHAPE_SIZE,
          erasers: [],
        };

        onInteractionStart?.();
        onSegmentsChange((prev) => [...prev, shape]);
        onSelectSegment(segmentId);
        interactionRef.current = {
          mode: "create-shape",
          pointerId,
          segmentId,
          start: { x: point.x, y: point.y },
        };
        return;
      }

      const selectedShape = segments.find((segment) => segment.id === selectedSegmentId);
      if (showOutlines && isBoxShape(selectedShape)) {
        const resizeHandle = getResizeHandleAtPoint(selectedShape, point);
        if (resizeHandle) {
          onSelectSegment(selectedShape.id);
          interactionRef.current = {
            mode: "resize-shape",
            pointerId,
            segmentId: selectedShape.id,
            handle: resizeHandle,
            originErasers: cloneEraserStrokes(selectedShape.erasers),
            origin: {
              x: selectedShape.x,
              y: selectedShape.y,
              w: selectedShape.w,
              h: selectedShape.h,
            },
          };
          onInteractionStart?.();
          return;
        }
      }

      const hit = getHitSegment(segments, point);
      if (!hit) {
        onSelectSegment(null);
        interactionRef.current = null;
        return;
      }

      onSelectSegment(hit.id);

      if (hit.type === "stroke") {
        interactionRef.current = null;
        return;
      }

      const resizeHandle =
        showOutlines && isBoxShape(hit) ? getResizeHandleAtPoint(hit, point) : null;
      const originPoints =
        !resizeHandle && hit.type === "polygon"
          ? (hit.points || []).map((p) => ({ x: p.x, y: p.y }))
          : null;
      interactionRef.current = {
        mode: resizeHandle ? "resize-shape" : "move-shape",
        pointerId,
        segmentId: hit.id,
        start: resizeHandle ? null : { x: point.x, y: point.y },
        handle: resizeHandle,
        originPoints,
        originErasers: cloneEraserStrokes(hit.erasers),
        origin: { x: hit.x, y: hit.y, w: hit.w, h: hit.h },
      };
      onInteractionStart?.();
    },
    [
      enabled,
      getPoint,
      previewFromPoint,
      tool,
      brushSize,
      onSegmentsChange,
      onSelectSegment,
      updateSegment,
      segments,
      selectedSegmentId,
      showOutlines,
      onInteractionStart,
    ],
  );

  const handlePointerMove = useCallback(
    (event) => {
      const interaction = interactionRef.current;
      const point = getPoint(event);
      if (!point) return;
      previewFromPoint(point);
      if (!interaction || interaction.pointerId !== event.pointerId) return;
      event.preventDefault();

      if (interaction.mode === "draw-polygon") {
        updateSegment(interaction.segmentId, (segment) => {
          const pts = segment.points || [];
          const nextPoints = appendPointIfNeeded(pts, point);
          if (nextPoints === pts) return segment;
          return {
            ...segment,
            points: nextPoints,
          };
        });
        return;
      }

      if (interaction.mode === "erase-attached") {
        updateSegment(interaction.segmentId, (segment) => {
          const erasers = segment.erasers || [];
          return {
            ...segment,
            erasers: erasers.map((eraserStroke) => {
              if (eraserStroke.id !== interaction.eraserId) return eraserStroke;
              const pts = eraserStroke.points || [];
              const nextPoints = appendPointIfNeeded(pts, point);
              if (nextPoints === pts) return eraserStroke;
              return {
                ...eraserStroke,
                points: nextPoints,
              };
            }),
          };
        });
        return;
      }

      if (interaction.mode === "create-shape") {
        updateSegment(interaction.segmentId, (segment) => {
          const start = interaction.start;
          const x = Math.min(start.x, point.x);
          const y = Math.min(start.y, point.y);
          const w = Math.max(MIN_SHAPE_SIZE, Math.abs(point.x - start.x));
          const h = Math.max(MIN_SHAPE_SIZE, Math.abs(point.y - start.y));
          return {
            ...segment,
            x: clamp01(x),
            y: clamp01(y),
            w: clamp01(w),
            h: clamp01(h),
          };
        });
        return;
      }

      if (interaction.mode === "move-shape") {
        const dx = point.x - interaction.start.x;
        const dy = point.y - interaction.start.y;
        updateSegment(interaction.segmentId, (segment) => {
          if (segment.type === "polygon") {
            const basePoints = interaction.originPoints || segment.points || [];
            if (!basePoints.length) return segment;
            const bounds = getPolygonBounds(basePoints);
            if (!bounds) return segment;

            const clampedDx = Math.max(-bounds.minX, Math.min(dx, 1 - bounds.maxX));
            const clampedDy = Math.max(-bounds.minY, Math.min(dy, 1 - bounds.maxY));
            const baseErasers = interaction.originErasers || segment.erasers || [];

            return {
              ...segment,
              points: basePoints.map((p) => ({
                x: clamp01(p.x + clampedDx),
                y: clamp01(p.y + clampedDy),
              })),
              erasers: translateEraserStrokes(baseErasers, clampedDx, clampedDy),
            };
          }

          const x = clamp01(interaction.origin.x + dx);
          const y = clamp01(interaction.origin.y + dy);
          const appliedDx = x - interaction.origin.x;
          const appliedDy = y - interaction.origin.y;
          const baseErasers = interaction.originErasers || segment.erasers || [];
          return {
            ...segment,
            x: Math.min(x, 1 - segment.w),
            y: Math.min(y, 1 - segment.h),
            erasers: translateEraserStrokes(baseErasers, appliedDx, appliedDy),
          };
        });
        return;
      }

      if (interaction.mode === "resize-shape") {
        const px = clamp01(point.x);
        const py = clamp01(point.y);
        const handle = interaction.handle;

        updateSegment(interaction.segmentId, (segment) => {
          if (!handle || !isBoxShape(segment)) return segment;

          let left = interaction.origin.x;
          let top = interaction.origin.y;
          let right = interaction.origin.x + interaction.origin.w;
          let bottom = interaction.origin.y + interaction.origin.h;

          if (handle === "w" || handle === "nw" || handle === "sw") {
            left = Math.min(Math.max(px, 0), right - MIN_SHAPE_SIZE);
          }
          if (handle === "e" || handle === "ne" || handle === "se") {
            right = Math.max(Math.min(px, 1), left + MIN_SHAPE_SIZE);
          }
          if (handle === "n" || handle === "nw" || handle === "ne") {
            top = Math.min(Math.max(py, 0), bottom - MIN_SHAPE_SIZE);
          }
          if (handle === "s" || handle === "sw" || handle === "se") {
            bottom = Math.max(Math.min(py, 1), top + MIN_SHAPE_SIZE);
          }

          const nextWidth = right - left;
          const nextHeight = bottom - top;
          const originWidth = Math.max(interaction.origin.w || 0, 1e-6);
          const originHeight = Math.max(interaction.origin.h || 0, 1e-6);
          const scaleFactor =
            Math.max(nextWidth, nextHeight) / Math.max(originWidth, originHeight);
          const baseErasers = interaction.originErasers || segment.erasers || [];

          return {
            ...segment,
            x: left,
            y: top,
            w: nextWidth,
            h: nextHeight,
            erasers: baseErasers.map((eraserStroke) => ({
              ...eraserStroke,
              size: Math.max(
                MIN_RESIZED_ERASER,
                getNormalizedStrokeSize(eraserStroke) * scaleFactor,
              ),
              points: (eraserStroke.points || []).map((p) => {
                const u = (p.x - interaction.origin.x) / originWidth;
                const v = (p.y - interaction.origin.y) / originHeight;
                return {
                  x: clamp01(left + u * nextWidth),
                  y: clamp01(top + v * nextHeight),
                };
              }),
            })),
          };
        });
      }
    },
    [getPoint, previewFromPoint, updateSegment],
  );

  const handlePointerUp = useCallback(
    (event) => {
      const interaction = interactionRef.current;
      if (!interaction || interaction.pointerId !== event.pointerId) return;

      svgRef.current?.releasePointerCapture?.(event.pointerId);

      if (interaction.mode === "create-shape") {
        const created = segments.find((s) => s.id === interaction.segmentId);
        if (created && (created.w < MIN_SHAPE_SIZE || created.h < MIN_SHAPE_SIZE)) {
          removeSegment(created.id);
        }
      }

      if (interaction.mode === "draw-polygon") {
        const created = segments.find((s) => s.id === interaction.segmentId);
        if (!created || created.type !== "polygon" || created.points.length < 3) {
          if (created) removeSegment(created.id);
        }
      }

      if (interaction.mode === "erase-attached") {
        updateSegment(interaction.segmentId, (segment) => ({
          ...segment,
          erasers: (segment.erasers || []).filter(
            (eraserStroke) =>
              eraserStroke.id !== interaction.eraserId ||
              (eraserStroke.points || []).length >= 2,
          ),
        }));
      }

      interactionRef.current = null;
      onInteractionEnd?.();
    },
    [segments, removeSegment, updateSegment, onInteractionEnd],
  );

  const handlePointerLeave = useCallback(() => {
    lastHoverPointRef.current = null;
    setEraserPreview(null);
  }, []);

  useEffect(() => {
    return () => {
      if (!interactionRef.current) return;
      interactionRef.current = null;
      onInteractionEnd?.();
    };
  }, [onInteractionEnd]);

  const selectedSegment = segments.find((segment) => segment.id === selectedSegmentId);

  return (
    <svg
      ref={svgRef}
      className={enabled ? `${className} ${enabledClassName || ""}` : className}
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      style={{ cursor: TOOL_CURSOR[tool] || "default" }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      {showOutlines &&
        segments.map((segment) => {
          const isSelected = segment.id === selectedSegmentId;
          const include = segment.mode !== "exclude";
          const stroke = include ? INCLUDE_STROKE : EXCLUDE_STROKE;
          const clipId = `mask-clip-${segment.id}`;
          const eraserOverlays = (segment.erasers || []).map((eraserStroke) => {
            const widthPx = getStrokeWidthPx(
              getNormalizedStrokeSize(eraserStroke),
              viewSize,
            );
            const overlayWidthPx = Math.max(
              1,
              widthPx + ERASER_OVERLAY_WIDTH_BUFFER_PX,
            );
            return (
              <g key={`erase-${segment.id}-${eraserStroke.id}`}>
                <path
                  d={formatPath(eraserStroke.points)}
                  className={styles.eraserOverlay}
                  stroke={EXCLUDE_STROKE}
                  strokeWidth={overlayWidthPx}
                />
              </g>
            );
          });

          if (isEditableMaskShape(segment)) {
            return (
              <g key={segment.id}>
                <defs>
                  <clipPath id={clipId}>
                    {renderSegmentShape(segment)}
                  </clipPath>
                </defs>
                {renderSegmentShape(segment, {
                  className: styles.segmentOutline,
                  stroke: isSelected ? SELECTED_STROKE : stroke,
                  strokeWidth: isSelected
                    ? SHAPE_STROKE_WIDTH_SELECTED
                    : SHAPE_STROKE_WIDTH,
                })}
                <g
                  className={styles.eraserOverlayGroup}
                  clipPath={`url(#${clipId})`}
                >
                  {eraserOverlays}
                </g>
              </g>
            );
          }

          return (
            <path
              key={segment.id}
              className={styles.segmentPath}
              d={formatPath(segment.points)}
              stroke={isSelected ? SELECTED_STROKE : stroke}
              strokeWidth={segment.size}
            />
          );
        })}

      {showOutlines &&
        enabled &&
        tool === "select" &&
        selectedSegment &&
        isBoxShape(selectedSegment) && (
          <>
            {RESIZE_HANDLES.map((handle) => {
              const point = getResizeHandlePoint(selectedSegment, handle);
              return (
                <rect
                  key={handle}
                  className={styles.resizeHandle}
                  x={point.x - HANDLE_SIZE / 2}
                  y={point.y - HANDLE_SIZE / 2}
                  width={HANDLE_SIZE}
                  height={HANDLE_SIZE}
                  cursor={HANDLE_CURSOR[handle]}
                />
              );
            })}
          </>
        )}

      {enabled && tool === "eraser" && eraserPreview && (
        <g className={styles.previewLayer}>
          <ellipse
            className={styles.previewRingOuter}
            cx={eraserPreview.x}
            cy={eraserPreview.y}
            rx={eraserPreview.rx}
            ry={eraserPreview.ry}
          />
          <ellipse
            className={styles.previewRingInner}
            cx={eraserPreview.x}
            cy={eraserPreview.y}
            rx={eraserPreview.rx}
            ry={eraserPreview.ry}
          />
          <circle
            className={styles.previewCenter}
            cx={eraserPreview.x}
            cy={eraserPreview.y}
            r={0.001}
          />
        </g>
      )}
    </svg>
  );
}

export default MaskEditor;
