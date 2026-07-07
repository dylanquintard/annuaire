import { Crosshair, MapPinned, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { PointerEvent, useRef, useState } from "react";

type Point = { x: number; y: number } | null;
type Box = { x: number; y: number; width: number; height: number };

export function MapPicker({ point, onChange }: { point: Point; onChange: (point: Point) => void }) {
  const overviewRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [selection, setSelection] = useState<Box | null>(null);
  const [draft, setDraft] = useState<Box | null>(null);

  const coordinates = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  };

  const beginSelection = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = coordinates(event);
    startRef.current = start;
    setDraft({ ...start, width: 0, height: 0 });
  };

  const moveSelection = (event: PointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    const current = coordinates(event);
    const start = startRef.current;
    setDraft({
      x: Math.min(start.x, current.x),
      y: Math.min(start.y, current.y),
      width: Math.abs(current.x - start.x),
      height: Math.abs(current.y - start.y),
    });
  };

  const finishSelection = () => {
    startRef.current = null;
    if (draft && draft.width > 0.025 && draft.height > 0.025) {
      setSelection(draft);
    }
    setDraft(null);
  };

  const choosePoint = (event: PointerEvent<HTMLDivElement>) => {
    if (!selection) return;
    const local = coordinates(event);
    onChange({
      x: selection.x + local.x * selection.width,
      y: selection.y + local.y * selection.height,
    });
  };

  const adjustZoom = (factor: number) => {
    const current = selection ?? { x: 0, y: 0, width: 1, height: 1 };
    const centerX = point?.x ?? current.x + current.width / 2;
    const centerY = point?.y ?? current.y + current.height / 2;
    const width = Math.max(0.04, Math.min(1, current.width * factor));
    const height = Math.max(0.04, Math.min(1, current.height * factor));
    setSelection({
      x: Math.max(0, Math.min(1 - width, centerX - width / 2)),
      y: Math.max(0, Math.min(1 - height, centerY - height / 2)),
      width,
      height,
    });
  };

  const activeBox = draft || selection;
  const zoomStyle = selection
    ? {
        backgroundSize: `${100 / selection.width}% ${100 / selection.height}%`,
        backgroundPosition: `${selection.width >= 0.999 ? 50 : (selection.x / (1 - selection.width)) * 100}% ${selection.height >= 0.999 ? 50 : (selection.y / (1 - selection.height)) * 100}%`,
      }
    : undefined;
  const zoomControls = (
    <div className="map-controls" onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()}>
      <button type="button" onClick={() => adjustZoom(0.65)} aria-label="Zoomer" title="Zoomer"><ZoomIn /></button>
      <button type="button" onClick={() => adjustZoom(1 / 0.65)} disabled={!selection || selection.width >= 0.999} aria-label="Dézoomer" title="Dézoomer"><ZoomOut /></button>
    </div>
  );

  return (
    <section className="map-picker wide">
      <div className="map-heading">
        <div><MapPinned /> <span>Adresse sur la carte</span></div>
        {(selection || point) && <button type="button" className="map-reset" onClick={() => { setSelection(null); onChange(null); }}><RotateCcw /> Recommencer</button>}
      </div>
      {!selection ? (
        <>
          <p>Tracez un rectangle autour du quartier à agrandir.</p>
          <div ref={overviewRef} className="map-canvas overview" onPointerDown={beginSelection} onPointerMove={moveSelection} onPointerUp={finishSelection} onPointerCancel={finishSelection}>
            {zoomControls}
            {activeBox && <span className="map-selection" style={{ left: `${activeBox.x * 100}%`, top: `${activeBox.y * 100}%`, width: `${activeBox.width * 100}%`, height: `${activeBox.height * 100}%` }} />}
            {point && <span className="map-pin" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}><Crosshair /></span>}
          </div>
        </>
      ) : (
        <>
          <p>Cliquez ou touchez l’emplacement exact de l’adresse.</p>
          <div className="map-canvas zoom" style={zoomStyle} onPointerUp={choosePoint}>
            {zoomControls}
            {point && point.x >= selection.x && point.x <= selection.x + selection.width && point.y >= selection.y && point.y <= selection.y + selection.height && <span className="map-pin" style={{ left: `${((point.x - selection.x) / selection.width) * 100}%`, top: `${((point.y - selection.y) / selection.height) * 100}%` }}><Crosshair /></span>}
          </div>
          <small>{point ? "Adresse positionnée. Vous pouvez toucher ailleurs pour l’ajuster." : "Aucun point choisi dans cette zone."}</small>
        </>
      )}
    </section>
  );
}
