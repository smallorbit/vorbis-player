import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';

interface Pure3DVisualizerProps {
  className?: string;
}

const CanvasContainer = styled.div`
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at center, #1a1a2e 0%, #0f0f1e 100%);
  position: relative;
  overflow: hidden;
`;

const Canvas3D = styled.canvas`
  width: 100%;
  height: 100%;
  display: block;
`;

const Pure3DVisualizer: React.FC<Pure3DVisualizerProps> = ({ className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    // Set canvas size
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Simple 3D sphere using WebGL
    const vertexShaderSource = `
      attribute vec3 position;
      attribute vec3 normal;
      uniform mat4 modelViewProjection;
      uniform float time;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      void main() {
        vec3 pos = position;
        // Add some wobble effect
        pos += normal * sin(time * 2.0 + position.y * 3.0) * 0.1;
        
        gl_Position = modelViewProjection * vec4(pos, 1.0);
        vNormal = normal;
        vPosition = pos;
      }
    `;

    const fragmentShaderSource = `
      precision mediump float;
      varying vec3 vNormal;
      varying vec3 vPosition;
      uniform float time;
      
      void main() {
        vec3 color = vec3(0.3, 0.8, 0.77); // #4ecdc4
        
        // Simple lighting
        vec3 light = normalize(vec3(1.0, 1.0, 1.0));
        float diff = max(dot(vNormal, light), 0.0);
        
        // Add some animation to the color
        color += sin(time + vPosition.y * 2.0) * 0.1;
        
        gl_FragColor = vec4(color * (0.3 + diff * 0.7), 1.0);
      }
    `;

    // Create and compile shader
    const createShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      
      return shader;
    };

    // Create program
    const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    // Create sphere geometry
    const createSphere = (radius: number, segments: number) => {
      const vertices = [];
      const normals = [];
      const indices = [];

      for (let i = 0; i <= segments; i++) {
        const theta = (i * Math.PI) / segments;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        for (let j = 0; j <= segments; j++) {
          const phi = (j * 2 * Math.PI) / segments;
          const sinPhi = Math.sin(phi);
          const cosPhi = Math.cos(phi);

          const x = cosPhi * sinTheta;
          const y = cosTheta;
          const z = sinPhi * sinTheta;

          vertices.push(radius * x, radius * y, radius * z);
          normals.push(x, y, z);
        }
      }

      for (let i = 0; i < segments; i++) {
        for (let j = 0; j < segments; j++) {
          const first = i * (segments + 1) + j;
          const second = first + segments + 1;

          indices.push(first, second, first + 1);
          indices.push(second, second + 1, first + 1);
        }
      }

      return { vertices, normals, indices };
    };

    const sphere = createSphere(1, 32);

    // Create buffers
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphere.vertices), gl.STATIC_DRAW);

    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphere.normals), gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(sphere.indices), gl.STATIC_DRAW);

    // Get attribute and uniform locations
    const positionLocation = gl.getAttribLocation(program, 'position');
    const normalLocation = gl.getAttribLocation(program, 'normal');
    const mvpLocation = gl.getUniformLocation(program, 'modelViewProjection');
    const timeLocation = gl.getUniformLocation(program, 'time');

    // Matrix math helpers
    const mat4 = {
      perspective: (fovy: number, aspect: number, near: number, far: number) => {
        const f = 1.0 / Math.tan(fovy / 2);
        return new Float32Array([
          f / aspect, 0, 0, 0,
          0, f, 0, 0,
          0, 0, (far + near) / (near - far), -1,
          0, 0, (2 * far * near) / (near - far), 0
        ]);
      },
      
      lookAt: (eye: number[], center: number[], up: number[]) => {
        const z = [eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]];
        const zLen = Math.sqrt(z[0] * z[0] + z[1] * z[1] + z[2] * z[2]);
        z[0] /= zLen; z[1] /= zLen; z[2] /= zLen;
        
        const x = [up[1] * z[2] - up[2] * z[1], up[2] * z[0] - up[0] * z[2], up[0] * z[1] - up[1] * z[0]];
        const xLen = Math.sqrt(x[0] * x[0] + x[1] * x[1] + x[2] * x[2]);
        x[0] /= xLen; x[1] /= xLen; x[2] /= xLen;
        
        const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
        
        return new Float32Array([
          x[0], y[0], z[0], 0,
          x[1], y[1], z[1], 0,
          x[2], y[2], z[2], 0,
          -x[0] * eye[0] - x[1] * eye[1] - x[2] * eye[2],
          -y[0] * eye[0] - y[1] * eye[1] - y[2] * eye[2],
          -z[0] * eye[0] - z[1] * eye[1] - z[2] * eye[2], 1
        ]);
      },
      
      multiply: (a: Float32Array, b: Float32Array) => {
        const result = new Float32Array(16);
        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 4; j++) {
            result[i * 4 + j] = 
              a[i * 4 + 0] * b[0 * 4 + j] +
              a[i * 4 + 1] * b[1 * 4 + j] +
              a[i * 4 + 2] * b[2 * 4 + j] +
              a[i * 4 + 3] * b[3 * 4 + j];
          }
        }
        return result;
      }
    };

    // Animation loop
    let time = 0;
    const animate = () => {
      time += 0.016;

      // Clear
      gl.clearColor(0.04, 0.04, 0.12, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);

      // Use program
      gl.useProgram(program);

      // Set up camera
      const aspect = canvas.width / canvas.height;
      const projection = mat4.perspective(Math.PI / 4, aspect, 0.1, 100);
      const cameraPos = [
        Math.cos(time * 0.5) * 5,
        Math.sin(time * 0.3) * 2,
        Math.sin(time * 0.5) * 5
      ];
      const view = mat4.lookAt(cameraPos, [0, 0, 0], [0, 1, 0]);
      const mvp = mat4.multiply(projection, view);

      // Set uniforms
      gl.uniformMatrix4fv(mvpLocation, false, mvp);
      gl.uniform1f(timeLocation, time);

      // Set up attributes
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
      gl.enableVertexAttribArray(normalLocation);
      gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0);

      // Draw
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.drawElements(gl.TRIANGLES, sphere.indices.length, gl.UNSIGNED_SHORT, 0);

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <CanvasContainer className={className}>
      <Canvas3D ref={canvasRef} />
    </CanvasContainer>
  );
};

export default Pure3DVisualizer;