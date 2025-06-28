import { useFrame, useThree } from "@react-three/fiber";
import { Spherical, type Vector3 } from "three";

const setFromSphericalZUp = (vec: Vector3, s: Spherical) => {
  const sinPhiRadius = Math.sin(s.phi) * s.radius;
  vec.x = sinPhiRadius * Math.sin(s.theta);
  vec.z = Math.cos(s.phi) * s.radius;
  vec.y = sinPhiRadius * Math.cos(s.theta);
  return vec;
};

// Default spherical limits for visualizers
// TODO: These will be expanded when specific visualizers are implemented
const useSphericalLimits = () => {
  // For now, return a default set of limits that work well for most visualizers
  return {
    rMin: 10,
    rMax: 18,
    rSpeed: 0.08,
    thetaMin: 0,
    thetaMax: 2 * Math.PI,
    thetaSpeed: 0.02,
    phiMin: Math.PI / 4,
    phiMax: Math.PI / 2,
    phiSpeed: 0.15,
  };
};

export const AutoOrbitCameraControls = () => {
  const camera = useThree((state) => state.camera);
  // r     is the Radius
  // theta is the equator angle
  // phi is the polar angle
  const limits = useSphericalLimits();
  const target = new Spherical();

  useFrame(({ clock }) => {
    if (!limits) {
      return;
    }
    const {
      rMin,
      rMax,
      rSpeed,
      thetaMin,
      thetaMax,
      thetaSpeed,
      phiMin,
      phiMax,
      phiSpeed,
    } = limits;
    const t = clock.elapsedTime;

    const rAlpha = 0.5 * (1 + Math.sin(t * rSpeed));
    const r = rMin + rAlpha * (rMax - rMin);

    const thetaAlpha = 0.5 * (1 + Math.cos(t * thetaSpeed));
    const theta = thetaMin + thetaAlpha * (thetaMax - thetaMin);

    const phiAlpha = 0.5 * (1 + Math.cos(t * phiSpeed));
    const phi = phiMin + phiAlpha * (phiMax - phiMin);

    setFromSphericalZUp(camera.position, target.set(r, phi, theta));
    camera.lookAt(0, 0, 0);
  });
  return null;
};