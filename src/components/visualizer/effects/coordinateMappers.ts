// Coordinate mapping system for audio-reactive visualizers

export const COORDINATE_TYPE = {
  CARTESIAN_2D: 'cartesian_2d',
  CARTESIAN_3D: 'cartesian_3d', 
  CARTESIAN_CUBE_FACES: 'cartesian_cube_faces',
  POLAR: 'polar',
} as const;

export const TWO_PI = Math.PI * 2;
export const HALF_DIAGONAL_UNIT_SQUARE = Math.sqrt(0.5 * 0.5 + 0.5 * 0.5);

export interface ICoordinateMapper {
  amplitude: number;
  map(
    coordinateType: string,
    x: number,
    y: number,
    z: number,
    elapsedTimeSec: number,
  ): number;
}

// Basic audio-reactive coordinate mapper implementation
export class AudioCoordinateMapper implements ICoordinateMapper {
  public amplitude: number;
  private audioData: Float32Array;
  
  constructor(amplitude: number = 1.0, audioData: Float32Array = new Float32Array(1024)) {
    this.amplitude = amplitude;
    this.audioData = audioData;
  }

  updateAudioData(data: Float32Array) {
    this.audioData = data;
  }

  map(
    coordinateType: string,
    x: number,
    y: number,
    z: number,
    elapsedTimeSec: number,
  ): number {
    // Simple wave-like mapping based on audio data
    const timeOffset = elapsedTimeSec * 0.5;
    
    switch (coordinateType) {
      case COORDINATE_TYPE.CARTESIAN_2D:
        return this.amplitude * Math.sin(x * TWO_PI + timeOffset) * Math.cos(y * TWO_PI + timeOffset);
      
      case COORDINATE_TYPE.CARTESIAN_3D:
        return this.amplitude * (Math.sin(x * TWO_PI + timeOffset) + Math.cos(y * TWO_PI + timeOffset) + Math.sin(z * TWO_PI + timeOffset)) / 3;
      
      case COORDINATE_TYPE.POLAR: {
        const angle = x * TWO_PI;
        const radius = y;
        return this.amplitude * Math.sin(angle + timeOffset) * radius;
      }
      
      case COORDINATE_TYPE.CARTESIAN_CUBE_FACES:
        return this.amplitude * Math.sin(x * TWO_PI + y * TWO_PI + z * TWO_PI + timeOffset);
      
      default:
        return this.amplitude * Math.sin(x * TWO_PI + timeOffset);
    }
  }
}