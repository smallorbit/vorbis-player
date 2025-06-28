// Core type definitions for visualizer effects

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

export interface TVisualProps {
  coordinateMapper: ICoordinateMapper;
}

export type TOmitVisualProps<T> = Omit<T, keyof TVisualProps>;