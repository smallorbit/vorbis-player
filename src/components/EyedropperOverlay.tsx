import React, { useRef, useEffect, useState } from 'react';

interface EyedropperOverlayProps {
  image: string;
  onPick: (color: string) => void;
  onClose: () => void;
}

const EyedropperOverlay: React.FC<EyedropperOverlayProps> = ({ image, onPick, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverColor, setHoverColor] = useState<string | null>(null);

  useEffect(() => {
    if (!image || !canvasRef.current) return;
    const img = new window.Image();
    img.crossOrigin = 'Anonymous';
    img.src = image;
    img.onload = () => {
      const canvas = canvasRef.current!;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) ctx.drawImage(img, 0, 0);
    };
  }, [image]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const color = `#${[pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('')}`;
    onPick(color);
    onClose();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const color = `#${[pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('')}`;
    setHoverColor(color);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
    }}>
      <div style={{ position: 'relative', background: '#222', borderRadius: 16, padding: 16, boxShadow: '0 4px 32px #0008' }}>
        <canvas
          ref={canvasRef}
          style={{
            maxWidth: 400,
            maxHeight: 400,
            borderRadius: 12,
            cursor: 'crosshair',
            boxShadow: '0 2px 16px #0006',
            display: 'block',
          }}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
        />
        <button onClick={onClose} style={{ position: 'absolute', top: 8, right: 8, background: '#111', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 16 }}>×</button>
        {hoverColor && (
          <div style={{ position: 'absolute', left: 16, bottom: 16, background: '#111c', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: 14, border: `2px solid ${hoverColor}` }}>
            {hoverColor}
            <span style={{ display: 'inline-block', width: 16, height: 16, background: hoverColor, borderRadius: 4, marginLeft: 8, border: '1px solid #fff' }} />
          </div>
        )}
      </div>
      <div style={{ color: '#fff', marginTop: 18, fontSize: 15 }}>Click a pixel on the album art to pick a color</div>
    </div>
  );
};

export default EyedropperOverlay; 