// Canvas utility components for background and effects

interface CanvasBackgroundProps {
  color?: string;
}

interface BackgroundFogProps {
  color?: string;
  near?: number;
  far?: number;
}

const useBackgroundColor = (customColor?: string) => {
  // For now, return a dark background that matches the app's theme
  // TODO: This could be made configurable or sync with app theme
  return customColor || "#0a0a0a";
};

export const CanvasBackground = ({ color }: CanvasBackgroundProps = {}) => {
  const backgroundColor = useBackgroundColor(color);
  return <color attach="background" args={[backgroundColor]} />;
};

export const BackgroundFog = ({ color, near = 20, far = 80 }: BackgroundFogProps = {}) => {
  const backgroundColor = useBackgroundColor(color);
  return <fog attach="fog" args={[backgroundColor, near, far]} />;
};