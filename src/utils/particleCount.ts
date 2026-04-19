interface ParticleCountConfig {
  countBaseMobile: number;
  countPixelDivisorMobile: number;
  countBaseDesktop: number;
  countPixelDivisor: number;
}

export function calculateParticleCount(
  width: number,
  height: number,
  intensityValue: number,
  config: ParticleCountConfig
): number {
  const pixelCount = width * height;
  const isMobile = width < 768;
  const scale = Math.max(0.1, intensityValue / 60);
  if (isMobile) {
    return Math.round(Math.min(config.countBaseMobile, Math.floor(pixelCount / config.countPixelDivisorMobile)) * scale);
  }
  return Math.round(Math.min(config.countBaseDesktop, Math.floor(pixelCount / config.countPixelDivisor)) * scale);
}
