export type ToolId = "select" | "detector" | "line" | "rect" | "text" | "erase";

export type OverlayItem =
  | { id: string; type: "detector"; x: number; y: number; label?: string }
  | { id: string; type: "line"; x1: number; y1: number; x2: number; y2: number }
  | { id: string; type: "rect"; x: number; y: number; w: number; h: number }
  | { id: string; type: "text"; x: number; y: number; text: string };

export type OverlayLayer = {
  id: string;
  name: string;
  visible: boolean;
  color: string;
  items: OverlayItem[];
};

export type OverlayVisibility = "all" | "admins";

export type PublishedOverlay = {
  id: string;
  drawingId: string;
  createdBy: string;
  toolType: ToolId;
  layerName: string;
  layerColor: string;
  payload: OverlayItem;
  visibilityScope: OverlayVisibility;
};
