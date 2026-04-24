// Minimal local declarations for react-svg-pan-zoom 3.x — the package does
// not ship TypeScript types and @types/react-svg-pan-zoom is not installed.
// Covers only the surface the SLD uses. Expand as needed.
declare module 'react-svg-pan-zoom' {
  import type { ComponentType, ReactNode, CSSProperties, Ref } from 'react';

  export type Tool = 'auto' | 'none' | 'pan' | 'zoom-in' | 'zoom-out';

  export interface Value {
    viewerWidth: number;
    viewerHeight: number;
    SVGWidth: number;
    SVGHeight: number;
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
    mode: string;
    [key: string]: unknown;
  }

  export interface ReactSVGPanZoomProps {
    width: number;
    height: number;
    tool: Tool;
    onChangeTool: (tool: Tool) => void;
    value: Value | Record<string, never>;
    onChangeValue: (value: Value) => void;
    background?: string;
    SVGBackground?: string;
    style?: CSSProperties;
    detectAutoPan?: boolean;
    detectWheel?: boolean;
    detectPinchGesture?: boolean;
    miniatureProps?: { position?: string };
    toolbarProps?: { position?: string; SVGAlignX?: string; SVGAlignY?: string };
    disableDoubleClickZoomWithToolAuto?: boolean;
    scaleFactorMin?: number;
    scaleFactorMax?: number;
    scaleFactor?: number;
    scaleFactorOnWheel?: number;
    children?: ReactNode;
  }

  export interface ReactSVGPanZoomInstance {
    fitToViewer: (SVGAlignX?: string, SVGAlignY?: string) => void;
    fitSelection: (
      selectionSVGPointX: number,
      selectionSVGPointY: number,
      selectionWidth: number,
      selectionHeight: number,
    ) => void;
    zoomOnViewerCenter: (scaleFactor: number) => void;
    reset: () => void;
    pan: (SVGDeltaX: number, SVGDeltaY: number) => void;
    setPointOnViewerCenter: (SVGPointX: number, SVGPointY: number, zoomLevel: number) => void;
  }

  export const ReactSVGPanZoom: ComponentType<
    ReactSVGPanZoomProps & { ref?: Ref<ReactSVGPanZoomInstance> }
  >;

  export const TOOL_AUTO: Tool;
  export const TOOL_NONE: Tool;
  export const TOOL_PAN: Tool;
  export const TOOL_ZOOM_IN: Tool;
  export const TOOL_ZOOM_OUT: Tool;

  export const POSITION_NONE: string;
  export const POSITION_TOP: string;
  export const POSITION_RIGHT: string;
  export const POSITION_BOTTOM: string;
  export const POSITION_LEFT: string;

  export const ALIGN_CENTER: string;
  export const ALIGN_LEFT: string;
  export const ALIGN_RIGHT: string;
  export const ALIGN_TOP: string;
  export const ALIGN_BOTTOM: string;
  export const ALIGN_COVER: string;

  export const INITIAL_VALUE: Record<string, never>;

  export function fitToViewer(
    value: Value | Record<string, never>,
    SVGAlignX?: string,
    SVGAlignY?: string,
  ): Value;

  export function reset(value: Value | Record<string, never>): Value;
}
