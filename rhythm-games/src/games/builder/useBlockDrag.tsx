// Pointer-based drag for Beat Builder blocks — works on mouse AND touch via the
// unified Pointer Events API. A palette block calls `startDrag(cell, e)` on
// pointerdown; this hook renders a floating "ghost" that follows the pointer and,
// on release, asks each registered drop-zone whether the pointer is over it.
//
// Drop zones register a ref + an onDrop callback. The whole thing lives in one
// place so index.tsx just wires `dragStartProps` onto blocks and `register` onto
// the grid. Tap-to-place still works because a release with little movement is
// treated as a "click" by the caller's own onClick (we don't preventDefault on a
// non-drag), while a real drag is intercepted here.

import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BeatCell } from '../../shared/audio/patterns'
import { BlockGlyph } from './BlockGlyph'

interface DropZone {
  el: HTMLElement
  onDrop: (cell: BeatCell) => void
}

interface DragState {
  cell: BeatCell
  x: number
  y: number
}

const DRAG_THRESHOLD = 6 // px before a press becomes a drag

export function useBlockDrag() {
  const zones = useRef<Map<string, DropZone>>(new Map())
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const movedRef = useRef(false)

  const register = useCallback((id: string, el: HTMLElement | null, onDrop: (cell: BeatCell) => void) => {
    if (el) zones.current.set(id, { el, onDrop })
    else zones.current.delete(id)
  }, [])

  const startDrag = useCallback((cell: BeatCell, e: React.PointerEvent) => {
    // Only left button / touch / pen.
    if (e.button != null && e.button > 0) return
    const startX = e.clientX
    const startY = e.clientY
    movedRef.current = false

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!movedRef.current && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        movedRef.current = true
        const st = { cell, x: ev.clientX, y: ev.clientY }
        dragRef.current = st
        setDrag(st)
      }
      if (movedRef.current) {
        ev.preventDefault()
        const st = { cell, x: ev.clientX, y: ev.clientY }
        dragRef.current = st
        setDrag(st)
        highlight(ev.clientX, ev.clientY)
      }
    }

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      clearHighlights()
      if (movedRef.current) {
        const zone = zoneAt(ev.clientX, ev.clientY)
        if (zone) zone.onDrop(cell)
      }
      dragRef.current = null
      setDrag(null)
      // movedRef stays true → caller's onClick checks it to suppress tap-add.
    }

    const zoneAt = (x: number, y: number): DropZone | null => {
      for (const z of zones.current.values()) {
        const r = z.el.getBoundingClientRect()
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return z
      }
      return null
    }
    const highlight = (x: number, y: number) => {
      const hit = zoneAt(x, y)
      for (const z of zones.current.values()) z.el.classList.toggle('is-dropactive', z === hit)
    }
    const clearHighlights = () => {
      for (const z of zones.current.values()) z.el.classList.remove('is-dropactive')
    }

    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }, [])

  /** True if the last press turned into a drag (so onClick should be ignored). */
  const consumedTap = useCallback(() => movedRef.current, [])

  const ghost = drag
    ? createPortal(
        <div
          className="bb__ghost"
          style={{ left: drag.x, top: drag.y }}
          aria-hidden
        >
          <BlockGlyph cell={drag.cell} width={104} />
          <span className="bb__blocksyl">{drag.cell.syllables.length ? drag.cell.syllables.join('-') : 'rest'}</span>
        </div>,
        document.body,
      )
    : null

  return { register, startDrag, consumedTap, ghost, dragging: drag != null }
}
