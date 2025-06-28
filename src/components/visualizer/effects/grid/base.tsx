import { useEffect, useMemo, useRef } from "react";
import { usePalette, ColorPalette } from "../colorPalettes";
import {
  COORDINATE_TYPE,
  type ICoordinateMapper,
} from "../coordinateMappers";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  Matrix4,
  MeshBasicMaterial,
  type InstancedMesh,
} from "three";

const BaseGrid = ({
  coordinateMapper,
  nGridRows = 100,
  nGridCols = 100,
  cubeSideLength = 0.025,
  cubeSpacingScalar = 5,
}: {
  coordinateMapper: ICoordinateMapper;
  nGridRows?: number;
  nGridCols?: number;
  cubeSideLength?: number;
  cubeSpacingScalar?: number;
}) => {
  const meshRef = useRef<InstancedMesh>(null!);
  const tmpMatrix = useMemo(() => new Matrix4(), []);
  const palette = usePalette();
  const lut = ColorPalette.getPalette(palette).buildLut();

  // Recolor
  useEffect(() => {
    if (!lut) {
      return;
    }
    const normQuadrantHypotenuse = Math.sqrt(0.5 * 0.5 + 0.5 * 0.5);
    let instanceIdx, normGridX, normGridY, normRadialOffset;
    for (let row = 0; row < nGridRows; row++) {
      for (let col = 0; col < nGridCols; col++) {
        instanceIdx = row * nGridCols + col;
        normGridX = row / (nGridRows - 1);
        normGridY = col / (nGridCols - 1);
        normRadialOffset =
          Math.sqrt((normGridX - 0.5) * (normGridX - 0.5) + (normGridY - 0.5) * (normGridY - 0.5)) / normQuadrantHypotenuse;
        meshRef.current.setColorAt(instanceIdx, lut.getColor(normRadialOffset));
      }
    }
    meshRef.current.instanceColor!.needsUpdate = true;
  }, [lut, nGridRows, nGridCols]);

  useFrame(({ clock }) => {
    //in ms
    const elapsedTimeSec = clock.getElapsedTime();
    const gridSizeX = nGridRows * cubeSpacingScalar * cubeSideLength;
    const gridSizeY = nGridCols * cubeSpacingScalar * cubeSideLength;
    let instanceIdx, normGridX, normGridY, x, y, z;
    for (let row = 0; row < nGridRows; row++) {
      for (let col = 0; col < nGridCols; col++) {
        instanceIdx = row * nGridCols + col;
        normGridX = row / (nGridRows - 1);
        normGridY = col / (nGridCols - 1);
        z = coordinateMapper.map(
          COORDINATE_TYPE.CARTESIAN_2D,
          normGridX,
          normGridY,
          0,
          elapsedTimeSec,
        );
        x = gridSizeX * (normGridX - 0.5);
        y = gridSizeY * (normGridY - 0.5);

        // adjust position of each cube
        tmpMatrix.setPosition(x, y, z);
        meshRef.current.setMatrixAt(instanceIdx, tmpMatrix);
      }
    }

    // Update the instance
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      castShadow={true}
      receiveShadow={true}
      args={[new BoxGeometry(), new MeshBasicMaterial(), nGridRows * nGridCols]}
    >
      <boxGeometry
        attach="geometry"
        args={[cubeSideLength, cubeSideLength, cubeSideLength, 1]}
      />
      <meshPhongMaterial attach="material" color="white" toneMapped={false} />
    </instancedMesh>
  );
};

export default BaseGrid;