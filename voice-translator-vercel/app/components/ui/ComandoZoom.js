'use client';
import { useState } from 'react';
import Icon from '../Icon.js';

export default function ComandoZoom({
  zoom, onZoomChange, verticalOffset, onVerticalOffsetChange
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="floating-zoom-control"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Zoom Slider */}
      <div className="zoom-slider-group">
        {isHovered && (
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        )}
        <input
          type="range"
          className="zoom-slider"
          min={0.5}
          max={2.0}
          step={0.01}
          value={zoom}
          onChange={(e) => onZoomChange(parseFloat(e.target.value))}
          title={`Zoom: ${Math.round(zoom * 100)}%`}
        />
        {/* b.482 — erano due emoji: la lente e la doppia freccia. */}
        <span className="zoom-icon"><Icon name="eye" size={13} /></span>
      </div>

      <div className="zoom-divider" />

      {/* Vertical Offset Slider */}
      <div className="zoom-slider-group">
        {isHovered && (
          <span className="zoom-label">
            {verticalOffset > 0 ? '+' : ''}{verticalOffset}px
          </span>
        )}
        <input
          type="range"
          className="zoom-slider"
          min={-200}
          max={200}
          step={5}
          value={verticalOffset}
          onChange={(e) => onVerticalOffsetChange(parseInt(e.target.value))}
          title={`Offset: ${verticalOffset}px`}
        />
        <span className="zoom-icon"><Icon name="swap" size={13} /></span>
      </div>
    </div>
  );
}
