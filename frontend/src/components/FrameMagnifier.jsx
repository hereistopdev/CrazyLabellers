import { useCallback, useEffect, useRef, useState } from 'react';
import FrameEventOverlay from './FrameEventOverlay';

const ZOOM_LEVELS = [2, 3, 4];

function getVideoDisplayRect(video, wrap) {
  const wrapW = wrap.clientWidth;
  const wrapH = wrap.clientHeight;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh || !wrapW || !wrapH) {
    return null;
  }

  const videoAspect = vw / vh;
  const wrapAspect = wrapW / wrapH;

  if (videoAspect > wrapAspect) {
    const displayW = wrapW;
    const displayH = wrapW / videoAspect;
    return {
      offsetX: 0,
      offsetY: (wrapH - displayH) / 2,
      displayW,
      displayH,
      vw,
      vh,
    };
  }

  const displayH = wrapH;
  const displayW = wrapH * videoAspect;
  return {
    offsetX: (wrapW - displayW) / 2,
    offsetY: 0,
    displayW,
    displayH,
    vw,
    vh,
  };
}

function getCropRect(videoWidth, videoHeight, zoom, focus) {
  const cropW = videoWidth / zoom;
  const cropH = videoHeight / zoom;
  const cx = focus.x * videoWidth;
  const cy = focus.y * videoHeight;
  const sx = Math.max(0, Math.min(videoWidth - cropW, cx - cropW / 2));
  const sy = Math.max(0, Math.min(videoHeight - cropH, cy - cropH / 2));

  return { sx, sy, cropW, cropH };
}

export default function FrameMagnifier({
  videoRef,
  currentTime,
  isPaused,
  enabled,
  onEnabledChange,
  submissionEvents,
  referenceEvents,
  fps = 25,
  children,
}) {
  const sourceCanvasRef = useRef(null);
  const viewCanvasRef = useRef(null);
  const videoWrapRef = useRef(null);
  const viewportRef = useRef(null);
  const [zoom, setZoom] = useState(3);
  const [focus, setFocus] = useState({ x: 0.5, y: 0.5 });
  const [regionStyle, setRegionStyle] = useState(null);
  const dragRef = useRef(null);

  const updateRegionOverlay = useCallback(() => {
    const video = videoRef.current;
    const wrap = videoWrapRef.current;
    if (!enabled || !video || !wrap || video.readyState < 2) {
      setRegionStyle(null);
      return;
    }

    const layout = getVideoDisplayRect(video, wrap);
    if (!layout) return;

    const { sx, sy, cropW, cropH } = getCropRect(layout.vw, layout.vh, zoom, focus);
    const scaleX = layout.displayW / layout.vw;
    const scaleY = layout.displayH / layout.vh;

    setRegionStyle({
      left: `${layout.offsetX + sx * scaleX}px`,
      top: `${layout.offsetY + sy * scaleY}px`,
      width: `${cropW * scaleX}px`,
      height: `${cropH * scaleY}px`,
    });
  }, [videoRef, enabled, zoom, focus]);

  const drawMagnifiedFrame = useCallback(() => {
    const video = videoRef.current;
    const source = sourceCanvasRef.current;
    const view = viewCanvasRef.current;
    if (!video || !source || !view || video.readyState < 2) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    source.width = w;
    source.height = h;
    source.getContext('2d')?.drawImage(video, 0, 0, w, h);

    updateRegionOverlay();

    if (!enabled) return;

    const { sx, sy, cropW, cropH } = getCropRect(w, h, zoom, focus);

    view.width = w;
    view.height = h;
    const ctx = view.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, sx, sy, cropW, cropH, 0, 0, w, h);
  }, [videoRef, enabled, zoom, focus, updateRegionOverlay]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const refresh = () => drawMagnifiedFrame();
    video.addEventListener('loadeddata', refresh);
    video.addEventListener('seeked', refresh);
    video.addEventListener('loadedmetadata', refresh);
    return () => {
      video.removeEventListener('loadeddata', refresh);
      video.removeEventListener('seeked', refresh);
      video.removeEventListener('loadedmetadata', refresh);
    };
  }, [videoRef, drawMagnifiedFrame]);

  useEffect(() => {
    if (isPaused) {
      const id = requestAnimationFrame(drawMagnifiedFrame);
      return () => cancelAnimationFrame(id);
    }
  }, [currentTime, isPaused, enabled, zoom, focus, drawMagnifiedFrame]);

  useEffect(() => {
    const wrap = videoWrapRef.current;
    if (!wrap) return;

    const observer = new ResizeObserver(() => updateRegionOverlay());
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [updateRegionOverlay]);

  const clampFocus = (point) => ({
    x: Math.max(0, Math.min(1, point.x)),
    y: Math.max(0, Math.min(1, point.y)),
  });

  const setFocusFromClient = (clientX, clientY, element) => {
    if (!element) return;
    const video = videoRef.current;
    if (!video) return;

    const layout = getVideoDisplayRect(video, element);
    if (!layout) return;

    const rect = element.getBoundingClientRect();
    const localX = clientX - rect.left - layout.offsetX;
    const localY = clientY - rect.top - layout.offsetY;

    if (localX < 0 || localY < 0 || localX > layout.displayW || localY > layout.displayH) {
      return;
    }

    setFocus(
      clampFocus({
        x: localX / layout.displayW,
        y: localY / layout.displayH,
      })
    );
  };

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleDragMove = useCallback(
    (event) => {
      const drag = dragRef.current;
      if (!drag) return;

      const element = drag.element;
      const video = videoRef.current;
      if (!video) return;

      const layout = getVideoDisplayRect(video, element);
      if (!layout) return;

      const rect = element.getBoundingClientRect();
      const dx = (event.clientX - drag.startX) / layout.displayW;
      const dy = (event.clientY - drag.startY) / layout.displayH;

      setFocus(
        clampFocus({
          x: drag.startFocus.x - dx / zoom,
          y: drag.startFocus.y - dy / zoom,
        })
      );
    },
    [videoRef, zoom]
  );

  useEffect(() => {
    const onMove = (e) => handleDragMove(e);
    const onUp = () => endDrag();
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [handleDragMove, endDrag]);

  const startMiddleDrag = (event, element) => {
    if (!enabled || event.button !== 1) return;
    event.preventDefault();
    dragRef.current = {
      element,
      startX: event.clientX,
      startY: event.clientY,
      startFocus: { ...focus },
    };
  };

  const handleLeftClick = (event, element) => {
    if (!enabled || event.button !== 0) return;
    setFocusFromClient(event.clientX, event.clientY, element);
  };

  const handleMouseDown = (event, element) => {
    if (event.button === 1) {
      startMiddleDrag(event, element);
      return;
    }
    if (event.button === 0) {
      handleLeftClick(event, element);
    }
  };

  const preventMiddleMenu = (event) => {
    if (event.button === 1) event.preventDefault();
  };

  useEffect(() => {
    const onKey = (event) => {
      if (!enabled) return;
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (event.key === '1') setZoom(2);
      if (event.key === '2') setZoom(3);
      if (event.key === '3') setZoom(4);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);

  return (
    <div className="video-magnifier">
      <canvas ref={sourceCanvasRef} className="magnifier-source-canvas" aria-hidden />

      <div
        ref={videoWrapRef}
        className={`video-stage${enabled ? ' magnify-active' : ''}`}
        onMouseDown={(e) => handleMouseDown(e, videoWrapRef.current)}
        onAuxClick={preventMiddleMenu}
      >
        {children}
        <FrameEventOverlay
          currentTime={currentTime}
          fps={fps}
          submissionEvents={submissionEvents}
          referenceEvents={referenceEvents}
        />
        {enabled && regionStyle && (
          <div className="magnify-region-rect" style={regionStyle} aria-hidden />
        )}
      </div>

      <div className="magnifier-toolbar">
        <button
          type="button"
          className={`btn btn-sm${enabled ? ' btn-primary' : ' btn-secondary'}`}
          onClick={() => onEnabledChange(!enabled)}
        >
          {enabled ? 'Magnify on' : 'Magnify'}
        </button>
        {enabled && (
          <>
            <span className="magnifier-toolbar-label">Zoom</span>
            {ZOOM_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                className={`btn btn-sm${zoom === level ? ' btn-primary' : ' btn-secondary'}`}
                onClick={() => setZoom(level)}
              >
                {level}×
              </button>
            ))}
            <span className="magnifier-hint">
              Rectangle shows magnified area · left-click to move · middle-drag to pan
            </span>
          </>
        )}
      </div>

      {enabled && (
        <div
          ref={viewportRef}
          className="magnifier-viewport"
          onMouseDown={(e) => handleMouseDown(e, viewportRef.current)}
          onAuxClick={preventMiddleMenu}
        >
          <canvas ref={viewCanvasRef} className="magnifier-view-canvas" />
          {!isPaused && (
            <div className="magnifier-overlay-msg">Pause on a frame to inspect with magnify</div>
          )}
        </div>
      )}
    </div>
  );
}
