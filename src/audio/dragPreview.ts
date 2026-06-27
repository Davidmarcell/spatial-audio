/** Ephemeral engine source used while dragging a palette tile over the canvas. */
export const DRAG_PREVIEW_INSTANCE_ID = '__drag-preview__';

export function isDragPreviewInstance(instanceId: string): boolean {
  return instanceId === DRAG_PREVIEW_INSTANCE_ID;
}
