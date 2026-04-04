'use client';
import { useRef, useState, useEffect, useCallback } from 'react';

// Horizontal swipeable carousel - shows 3 items at a time
// Props: items[], renderItem(item, index, isSelected), selectedIndex, onSelect(index), itemWidth (optional)
export default function Carousel({ items, renderItem, selectedIndex = 0, onSelect, itemWidth = 90, gap = 10, style = {} }) {
  const containerRef = useRef(null);
  const touchStartRef = useRef(null);
  const scrollStartRef = useRef(null);
  const isDraggingRef = useRef(false);

  // Scroll to selected item (center it)
  const scrollToIndex = useCallback((idx) => {
    const el = containerRef.current;
    if (!el) return;
    const totalItemW = itemWidth + gap;
    const containerW = el.clientWidth;
    const scrollTarget = (idx * totalItemW) - (containerW / 2) + (totalItemW / 2);
    el.scrollTo({ left: Math.max(0, scrollTarget), behavior: 'smooth' });
  }, [itemWidth, gap]);

  useEffect(() => {
    scrollToIndex(selectedIndex);
  }, [selectedIndex, scrollToIndex]);

  // Touch/drag handling for mobile swipe
  function handleTouchStart(e) {
    touchStartRef.current = e.touches[0].clientX;
    scrollStartRef.current = containerRef.current?.scrollLeft || 0;
    isDraggingRef.current = false;
  }

  function handleTouchMove(e) {
    if (touchStartRef.current === null) return;
    const diff = touchStartRef.current - e.touches[0].clientX;
    if (Math.abs(diff) > 5) isDraggingRef.current = true;
    if (containerRef.current) {
      containerRef.current.scrollLeft = scrollStartRef.current + diff;
    }
  }

  function handleTouchEnd() {
    touchStartRef.current = null;
    scrollStartRef.current = null;
    // isDragging resets on next click check
  }

  function handleItemClick(index) {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      return;
    }
    if (onSelect) onSelect(index);
  }

  // Mouse drag for desktop
  const mouseDownRef = useRef(false);
  const mouseStartXRef = useRef(0);
  const mouseScrollRef = useRef(0);

  function handleMouseDown(e) {
    mouseDownRef.current = true;
    mouseStartXRef.current = e.clientX;
    mouseScrollRef.current = containerRef.current?.scrollLeft || 0;
    isDraggingRef.current = false;
    e.preventDefault();
  }

  const handleMouseMove = useCallback((e) => {
    if (!mouseDownRef.current) return;
    const diff = mouseStartXRef.current - e.clientX;
    if (Math.abs(diff) > 5) isDraggingRef.current = true;
    if (containerRef.current) {
      containerRef.current.scrollLeft = mouseScrollRef.current + diff;
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    mouseDownRef.current = false;
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      style={{
        display: 'flex',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch',
        gap: gap,
        padding: '8px 4px',
        cursor: 'grab',
        userSelect: 'none',
        ...style
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          onClick={() => handleItemClick(i)}
          style={{
            flexShrink: 0,
            width: itemWidth,
            cursor: 'pointer',
            transition: 'transform 0.2s, opacity 0.2s',
            transform: i === selectedIndex ? 'scale(1.08)' : 'scale(0.95)',
            opacity: i === selectedIndex ? 1 : 0.7,
          }}
        >
          {renderItem(item, i, i === selectedIndex)}
        </div>
      ))}
    </div>
  );
}
