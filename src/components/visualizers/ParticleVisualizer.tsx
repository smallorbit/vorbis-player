import React, { useEffect, useRef, useCallback } from 'react';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';
import { generateColorVariant } from '../../utils/visualizerUtils';

interface ParticleVisualizerProps {
  intensity: number;
  accentColor: string;
  isPlaying: boolean;
  playbackPosition?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  opacity: number;
  baseOpacity: number;
  color: string;
  pulsePhase: number;
  pulseSpeed: number;
}

/**
 * ParticleVisualizer Component
 * 
 * Renders a particle system visualizer with floating particles that drift,
 * pulse, and change opacity based on playback state.
 * 
 * @component
 */
export const ParticleVisualizer: React.FC<ParticleVisualizerProps> = ({
  intensity,
  accentColor,
  isPlaying
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const lastFrameTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();

  // Calculate particle count based on viewport size
  const getParticleCount = useCallback((width: number, height: number): number => {
    const pixelCount = width * height;
    const isMobile = width < 768;
    
    if (isMobile) {
      return Math.min(30, Math.floor(pixelCount / 20000));
    }
    
    return Math.min(80, Math.floor(pixelCount / 15000));
  }, []);

  // Initialize particles
  const initializeParticles = useCallback((
    count: number,
    width: number,
    height: number,
    baseColor: string
  ): Particle[] => {
    const minRadius = 3;
    const maxRadius = 8;
    
    return Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      radius: minRadius + Math.random() * (maxRadius - minRadius),
      baseRadius: minRadius + Math.random() * (maxRadius - minRadius),
      opacity: 0.3 + Math.random() * 0.4,
      baseOpacity: 0.3 + Math.random() * 0.4,
      color: generateColorVariant(baseColor, Math.random() * 0.5 + 0.3),
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.01 + Math.random() * 0.02
    }));
  }, []);

  // Initialize particles resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Reinitialize particles on resize
      const particleCount = getParticleCount(canvas.width, canvas.height);
      particlesRef.current = initializeParticles(particleCount, canvas.width, canvas.height, accentColor);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const animId = animationFrameRef.current;
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animId) {
        cancelAnimationFrame(animId);
      }
    };
  }, [accentColor, getParticleCount, initializeParticles]);

  // Update particles when accent color changes
  useEffect(() => {
    particlesRef.current.forEach(particle => {
      particle.color = generateColorVariant(accentColor, Math.random() * 0.5 + 0.3);
    });
  }, [accentColor]);

  // Update particles
  const updateParticles = useCallback((
    particles: Particle[],
    deltaTime: number,
    isPlaying: boolean,
    width: number,
    height: number
  ): void => {
    const speedMultiplier = isPlaying ? 1.0 : 0.3; // Slow down when paused
    
    particles.forEach(particle => {
      // Update position
      particle.x += particle.vx * speedMultiplier * (deltaTime / 16); // Normalize to ~60fps
      particle.y += particle.vy * speedMultiplier * (deltaTime / 16);
      
      // Wrap around screen edges
      if (particle.x < 0) particle.x = width;
      if (particle.x > width) particle.x = 0;
      if (particle.y < 0) particle.y = height;
      if (particle.y > height) particle.y = 0;
      
      // Update pulse phase
      particle.pulsePhase += particle.pulseSpeed * speedMultiplier;
      if (particle.pulsePhase > Math.PI * 2) particle.pulsePhase -= Math.PI * 2;
      
      // Calculate pulsing radius and opacity
      // Use normalized sin value (0 to 1) to ensure radius never goes negative
      const pulseValue = (Math.sin(particle.pulsePhase) + 1) / 2; // Normalize to 0-1
      particle.radius = Math.max(1.5, particle.baseRadius + (pulseValue - 0.5) * 3); // Pulse around baseRadius with larger variation
      particle.opacity = Math.max(0.1, Math.min(1.0, particle.baseOpacity + (pulseValue - 0.5) * 0.4));
    });
  }, []);

  // Render particles
  const renderParticles = useCallback((
    ctx: CanvasRenderingContext2D,
    particles: Particle[],
    width: number,
    height: number,
    intensity: number
  ): void => {
    ctx.clearRect(0, 0, width, height);
    
    particles.forEach(particle => {
      ctx.save();
      ctx.globalAlpha = particle.opacity * (intensity / 100);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }, []);

  // Animation loop
  const animate = useCallback((currentTime: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const deltaTime = currentTime - lastFrameTimeRef.current;
    lastFrameTimeRef.current = currentTime;

    // Skip if deltaTime is too large (tab was hidden)
    if (deltaTime > 1000) {
      return;
    }

    // Update particles
    updateParticles(particlesRef.current, deltaTime, isPlaying, canvas.width, canvas.height);

    // Render particles
    renderParticles(ctx, particlesRef.current, canvas.width, canvas.height, intensity);
  }, [isPlaying, intensity, updateParticles, renderParticles]);

  useAnimationFrame(animate);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block'
      }}
    />
  );
};

