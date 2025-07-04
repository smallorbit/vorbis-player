import React, { useRef, useEffect, useState } from 'react';
import styled from 'styled-components';
import type { Track } from '../services/spotify';
import { theme } from '@/styles/theme';

interface AlbumArtProps {
  currentTrack: Track | null;
  objectPosition?: string;
  accentColor?: string;
}
// const objectPosition = 'center center calc(50% + 3.5rem)';
const AlbumArtContainer = styled.div<{ accentColor?: string }>`
  
  border-radius: 1.25rem;
  position: relative;
  overflow: hidden;
  background: transparent;
  margin: 1.25rem;
  backdrop-filter: blur(10px);
  z-index: 2;
`;

const AccentOverlay = styled.div<{ accentColor?: string }>`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
  background: ${({ accentColor }) =>
    accentColor
      ? `radial-gradient(circle at 50% 50%, ${accentColor} 60%, transparent 100%)`
      : 'transparent'};
  mix-blend-mode: lighten;
  opacity: 0.85;
  animation: accentBreath 3.2s ease-in-out infinite;
  filter: saturate(1.2) brightness(1.1);

  @keyframes accentBreath {
    0% {
      filter: saturate(1.2) brightness(1.1);
      opacity: 0.7;
    }
    50% {
      filter: saturate(2.5) brightness(1.5);
      opacity: 1;
    }
    100% {
      filter: saturate(1.2) brightness(1.1);
      opacity: 0.7;
    }
  }
`;

const colorDistance = (color1: [number, number, number], color2: [number, number, number]): number => {
  const [r1, g1, b1] = color1;
  const [r2, g2, b2] = color2;
  return Math.sqrt((r2 - r1) ** 2 + (g2 - g1) ** 2 + (b2 - b1) ** 2);
};

const hexToRgb = (hex: string): [number, number, number] => {
  const cleanHex = hex.replace('#', '');
  return [
    parseInt(cleanHex.substr(0, 2), 16),
    parseInt(cleanHex.substr(2, 2), 16),
    parseInt(cleanHex.substr(4, 2), 16)
  ];
};

const AlbumArt: React.FC<AlbumArtProps> = ({ currentTrack = null, accentColor }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [breath, setBreath] = useState(1);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (!currentTrack?.image || !accentColor || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0, img.width, img.height);
      // Save original image data for animation
      const original = ctx.getImageData(0, 0, img.width, img.height);
      const accentRgb = hexToRgb(accentColor);
      const minThreshold = 30; // full effect
      const maxThreshold = 100; // full fade-out
      let t = 0;
      const animate = () => {
        t += 0.1;
        // Breathing: oscillate between 1 and 2.5
        // const vibrance = 1.2 + Math.sin(t) * 1.3;
        const vibrance = 1.05 + Math.sin(t) * 1.1;
        setBreath(vibrance);
        const imageData = ctx.createImageData(original);
        for (let i = 0; i < original.data.length; i += 4) {
          const r = original.data[i];
          const g = original.data[i + 1];
          const b = original.data[i + 2];
          const a = original.data[i + 3];
          const dist = colorDistance([r, g, b], accentRgb);
          if (dist < maxThreshold) {
            // Feathered alpha: 1.0 at minThreshold, 0.0 at maxThreshold
            let alpha = 1;
            if (dist > minThreshold) {
              alpha = 1 - (dist - minThreshold) / (maxThreshold - minThreshold);
            }
            alpha = Math.max(0, Math.min(1, alpha));
            // Animate vibrance/saturation
            let [h, s, l] = rgbToHsl(r, g, b);
            // s = Math.min(1, s * vibrance * 0.5);
            l = Math.min(1, l * (1 + (vibrance - 1) * 0.125));
            const [nr, ng, nb] = hslToRgb(h, s, l);
            imageData.data[i] = nr;
            imageData.data[i + 1] = ng;
            imageData.data[i + 2] = nb;
            imageData.data[i + 3] = Math.round(a * alpha);
          } else {
            imageData.data[i] = 0;
            imageData.data[i + 1] = 0;
            imageData.data[i + 2] = 0;
            imageData.data[i + 3] = 0;
          }
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.putImageData(imageData, 0, 0);
        animationRef.current = requestAnimationFrame(animate);
      };
      animate();
    };
    img.src = currentTrack.image;
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [currentTrack?.image, accentColor]);

  // Helper: RGB <-> HSL
  function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return [h, s, l];
  }
  function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    let r, g, b;
    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  if (!currentTrack) return null;
  return (
    <AlbumArtContainer accentColor={accentColor} >
      {currentTrack?.image && (
        <img
          src={currentTrack.image}
          alt={currentTrack.name}
          style={{
            scale: '1.0',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            overflow: 'hidden',
            borderRadius: '1.25rem',
            position: 'relative',
            display: 'block',
          }}
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = `https://via.placeholder.com/400x300/1a1a1a/ffffff?text=${encodeURIComponent(currentTrack.name || 'No Image')}`;
          }}
        />
      )}
      {/* Accent color pixel mask breathing overlay */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 3,
          borderRadius: '1.25rem',
        }}
      />
    </AlbumArtContainer>
  );
};

export default AlbumArt; 