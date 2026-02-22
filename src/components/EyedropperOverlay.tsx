import React, { useRef, useEffect, useState } from 'react';
import { useTheme } from 'styled-components';

interface EyedropperOverlayProps {
  image: string;
  onPick: (color: string) => void;
  onClose: () => void;
}

const EyedropperOverlay: React.FC<EyedropperOverlayProps> = ({ image, onPick, onClose }) => {
  const theme = useTheme();
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
    <div
      data-eyedropper-overlay="true"
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: theme.colors.overlay.eyedropper,
        zIndex: theme.zIndex.eyedropper,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
      }}>
      <div style={{
        position: 'relative',
        background: theme.colors.gray[800],
        borderRadius: theme.borderRadius['2xl'],
        padding: theme.spacing.md,
        boxShadow: theme.shadows.lg,
      }}>
        <canvas
          ref={canvasRef}
          style={{
            maxWidth: 400,
            maxHeight: 400,
            borderRadius: theme.borderRadius.xl,
            cursor: 'crosshair',
            boxShadow: theme.shadows.md,
            display: 'block',
          }}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
        />
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: theme.spacing.sm,
            right: theme.spacing.sm,
            background: theme.colors.gray[900],
            color: theme.colors.white,
            border: 'none',
            borderRadius: theme.borderRadius.md,
            padding: `${theme.spacing.xs} 10px`,
            cursor: 'pointer',
            fontSize: theme.fontSize.base,
          }}
        >
          ×
        </button>
        {hoverColor && (
          <div style={{
            position: 'absolute',
            left: theme.spacing.md,
            bottom: theme.spacing.md,
            background: theme.colors.popover.background,
            color: theme.colors.white,
            padding: `${theme.spacing.xs} 10px`,
            borderRadius: theme.borderRadius.md,
            fontSize: theme.fontSize.sm,
            border: `2px solid ${hoverColor}`,
          }}>
            {hoverColor}
            <span style={{
              display: 'inline-block',
              width: 16,
              height: 16,
              background: hoverColor,
              borderRadius: theme.borderRadius.xs,
              marginLeft: theme.spacing.sm,
              border: `1px solid ${theme.colors.white}`,
            }} />
          </div>
        )}
      </div>
      <div style={{
        color: theme.colors.white,
        marginTop: theme.spacing.lg,
        fontSize: theme.fontSize.lg,
      }}>
        Click a pixel on the album art to pick a color
      </div>
    </div>
  );
};

export default EyedropperOverlay; 