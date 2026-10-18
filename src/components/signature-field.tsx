'use client';
import { useEffect, useRef, useState } from 'react';

/** Podpisové pole: kreslí se prstem/myší, výsledek jde do skrytého inputu jako PNG data URL. */
export default function SignatureField({ name, label, required = false }: { name: string; label: string; required?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    const c = canvas.current!;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a2a6b';
    let down = false;
    const pos = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as const;
    };
    const start = (e: PointerEvent) => {
      down = true;
      c.setPointerCapture(e.pointerId);
      const [x, y] = pos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };
    const move = (e: PointerEvent) => {
      if (!down) return;
      const [x, y] = pos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    };
    const end = () => {
      if (!down) return;
      down = false;
      setValue(c.toDataURL('image/png'));
    };
    c.addEventListener('pointerdown', start);
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    return () => {
      c.removeEventListener('pointerdown', start);
      c.removeEventListener('pointermove', move);
      c.removeEventListener('pointerup', end);
      c.removeEventListener('pointercancel', end);
    };
  }, []);

  function clear() {
    const c = canvas.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setValue('');
  }

  return (
    <div className="sig">
      <span className="lbl">
        {label}
        {required && ' *'}
      </span>
      <canvas ref={canvas} className="sigpad" aria-label={label} />
      <input type="hidden" name={name} value={value} />
      <div className="sig-act">
        <span className="muted small">{value ? '✓ Podepsáno' : 'Podepište se prstem'}</span>
        <button type="button" className="btn sm ghost" onClick={clear}>
          Smazat
        </button>
      </div>
    </div>
  );
}
