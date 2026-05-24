import React, { useState, useRef, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Pipette } from 'lucide-react';

const ZEN_EYEDROPPER_TRIGGER_Z = 6;
const ZEN_EYEDROPPER_PICK_Z = 10;

interface ZenEyedropperOverlayProps {
  image: string;
  isVisible: boolean;
  onPick: (color: string) => void;
}

const TriggerButton = styled.button.withConfig({
  shouldForwardProp: (prop) => !['$isVisible'].includes(prop),
})<{ $isVisible: boolean }>`
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: ${ZEN_EYEDROPPER_TRIGGER_Z};
  pointer-events: ${({ $isVisible }) => ($isVisible ? 'auto' : 'none')};
  background: rgba(0, 0, 0, 0.45);
  border-radius: ${({ theme }) => theme.borderRadius.full};
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: clamp(2rem, 10%, 3.5rem);
  height: clamp(2rem, 10%, 3.5rem);
  aspect-ratio: 1;
  padding: 0;
  color: ${({ theme }) => theme.colors.white};
  opacity: ${({ $isVisible }) => ($isVisible ? 1 : 0)};
  transition: opacity 150ms ease;
`;

const PickCanvas = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: ${ZEN_EYEDROPPER_PICK_Z};
  cursor: crosshair;
  border-radius: ${({ theme }) => theme.borderRadius['3xl']};
`;

const ColorTooltip = styled.div`
  position: absolute;
  z-index: ${ZEN_EYEDROPPER_PICK_Z + 1};
  pointer-events: none;
  display: flex;
  align-items: center;
  background: ${({ theme }) => theme.colors.popover.background};
  color: ${({ theme }) => theme.colors.white};
  padding: ${({ theme }) => `${theme.spacing.xs} 10px`};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

const Swatch = styled.span`
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: ${({ theme }) => theme.borderRadius.xs};
  margin-left: ${({ theme }) => theme.spacing.sm};
  border: 1px solid ${({ theme }) => theme.colors.white};
`;

export const ZenEyedropperOverlay: React.FC<ZenEyedropperOverlayProps> = React.memo(({
  image,
  isVisible,
  onPick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [hoverColor, setHoverColor] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const exitPicking = useCallback(() => {
    setIsPicking(false);
    setHoverColor(null);
  }, []);

  useEffect(() => {
    if (!isPicking) return;
    const handlePointerDownOutside = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (canvas && e.target instanceof Node && canvas.contains(e.target)) return;
      exitPicking();
    };
    document.addEventListener('mousedown', handlePointerDownOutside);
    return () => document.removeEventListener('mousedown', handlePointerDownOutside);
  }, [isPicking, exitPicking]);

  useEffect(() => {
    if (!isPicking || !image) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new window.Image();
    img.crossOrigin = 'Anonymous';
    img.src = image;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) ctx.drawImage(img, 0, 0);
    };
  }, [isPicking, image]);

  useEffect(() => {
    if (!isPicking) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        exitPicking();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPicking, exitPicking]);

  const sampleColorAt = useCallback((e: React.MouseEvent<HTMLCanvasElement>): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    return `#${[pixel[0] ?? 0, pixel[1] ?? 0, pixel[2] ?? 0].map(v => v.toString(16).padStart(2, '0')).join('')}`;
  }, []);

  const handleTriggerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPicking(true);
  }, []);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const color = sampleColorAt(e);
    if (color) setHoverColor(color);
    setTooltipPos({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
  }, [sampleColorAt]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    const color = sampleColorAt(e);
    if (color) onPick(color);
    exitPicking();
  }, [sampleColorAt, onPick, exitPicking]);

  return (
    <>
      <TriggerButton
        $isVisible={isVisible && !isPicking}
        aria-label="Pick accent color from album art"
        onClick={handleTriggerClick}
      >
        <Pipette aria-hidden="true" style={{ width: '55%', height: '55%' }} />
      </TriggerButton>
      {isPicking && (
        <>
          <PickCanvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMouseMove}
          />
          {hoverColor && (
            <ColorTooltip
              style={{
                left: tooltipPos.x + 16,
                top: tooltipPos.y + 16,
                border: `2px solid ${hoverColor}`,
              }}
            >
              {hoverColor}
              <Swatch style={{ background: hoverColor }} />
            </ColorTooltip>
          )}
        </>
      )}
    </>
  );
});

ZenEyedropperOverlay.displayName = 'ZenEyedropperOverlay';
