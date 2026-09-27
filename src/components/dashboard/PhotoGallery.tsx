"use client";

import { useEffect, useRef, useState } from "react";

type Photo = { id: string; width: number; height: number };

/** Complaint photo thumbnails with a full-size viewer (arrow keys and Escape work). */
export function PhotoGallery({ photos }: { photos: Photo[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const open = (i: number) => {
    setIndex(i);
    dialog.current?.showModal();
  };
  const step = (d: number) => setIndex((i) => (i + d + photos.length) % photos.length);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % photos.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + photos.length) % photos.length);
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [photos.length]);

  if (photos.length === 0) return null;
  const current = photos[index];
  return (
    <div>
      <div className="sub-h" style={{ marginBottom: 8 }}>Photos from the customer ({photos.length})</div>
      <div className="photo-row">
        {photos.map((p, i) => (
          <button key={p.id} type="button" className="photo-thumb" style={{ padding: 0, cursor: "zoom-in" }} onClick={() => open(i)} aria-label={`Open photo ${i + 1} of ${photos.length}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/photos/${p.id}`} alt="" loading="lazy" />
          </button>
        ))}
      </div>
      <dialog ref={dialog} className="viewer" aria-label="Customer photo" onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
        <div className="viewer-bar">
          <span className="num">Photo {index + 1} of {photos.length}</span>
          <div className="toolbar">
            {photos.length > 1 && (
              <>
                <button type="button" className="btn-ghost btn-sm" onClick={() => step(-1)} aria-label="Previous photo">‹ Previous</button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => step(1)} aria-label="Next photo">Next ›</button>
              </>
            )}
            <button type="button" className="btn btn-sm" onClick={() => dialog.current?.close()} autoFocus>Close</button>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/photos/${current.id}`} alt={`Customer photo ${index + 1}`} width={current.width} height={current.height} />
      </dialog>
    </div>
  );
}
