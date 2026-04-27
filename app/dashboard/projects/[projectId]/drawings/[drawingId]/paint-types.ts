export type ToolId = "select" | "detector" | "point" | "line" | "rect" | "text" | "erase";

export type DetectorChecklist = {
  baseMounted: boolean;
  detectorMounted: boolean;
  capOn: "yes" | "no" | null;
  comment: string;
  photoDataUrl: string | null;
  photoPath?: string | null;
  serialNumber?: string;
  updatedAt: string | null;
};

export type PointChecklist = {
  comment: string;
  photoDataUrl: string | null;
  photoPath?: string | null;
  updatedAt: string | null;
};

export type OverlayItem =
  | { id: string; type: "detector"; x: number; y: number; label?: string; checklist?: DetectorChecklist }
  | { id: string; type: "point"; x: number; y: number; label?: string; checklist?: PointChecklist }
  | {
      id: string;
      type: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      c1x?: number;
      c1y?: number;
      c2x?: number;
      c2y?: number;
    }
  | { id: string; type: "rect"; x: number; y: number; w: number; h: number }
  | { id: string; type: "text"; x: number; y: number; text: string };

export type OverlayLayer = {
  id: string;
  name: string;
  visible: boolean;
  color: string;
  items: OverlayItem[];
};

/** null = visible to all users with blueprint access; string[] = specific user IDs only */
export type OverlayVisibility = string[] | null;

export type PublishedOverlay = {
  id: string;
  drawingId: string;
  createdBy: string;
  toolType: ToolId;
  layerName: string;
  layerColor: string;
  payload: OverlayItem;
  visibleToUserIds: OverlayVisibility;
};

export type CompanyMember = {
  id: string;
  fullName: string | null;
};

export type DrawingActivityAction = "publish_overlay" | "delete_overlay" | "update_overlay";

/** docX/docY er i PDF-/dokumentkoordinater (samme som overlay-payload x,y). */
export type DrawingActivityFocusMeta = {
  docX?: number;
  docY?: number;
};

export type DrawingActivityEntry = {
  id: string;
  drawingId: string;
  actorId: string;
  actorName: string | null;
  action: DrawingActivityAction;
  overlayId: string | null;
  toolType: string | null;
  summary: string;
  meta: DrawingActivityFocusMeta;
  createdAt: string;
};
