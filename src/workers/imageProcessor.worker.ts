// Web Worker for off-main-thread image processing
// Handles heavy canvas operations like pixel manipulation and color distance calculations

export interface ImageProcessingRequest {
  type: 'PROCESS_IMAGE';
  imageData: ImageData;
  accentColor: [number, number, number];
  maxDistance: number;
  requestId: number;
}

export interface ImageProcessingResponse {
  type: 'IMAGE_PROCESSED';
  processedImageData: ImageData;
  success: true;
  requestId: number;
}

export interface ImageProcessingError {
  type: 'IMAGE_PROCESSING_ERROR';
  error: string;
  success: false;
  requestId: number;
}

export type WorkerMessage = ImageProcessingRequest;
export type WorkerResponse = ImageProcessingResponse | ImageProcessingError;

// Color distance calculation function - moved from AccentColorGlowOverlay
const colorDistance = (color1: [number, number, number], color2: [number, number, number]): number => {
  const [r1, g1, b1] = color1;
  const [r2, g2, b2] = color2;
  return Math.sqrt((r2 - r1) ** 2 + (g2 - g1) ** 2 + (b2 - b1) ** 2);
};

// Main image processing function - moved from AlbumArt component
const processImageData = (
  imageData: ImageData, 
  accentColorRgb: [number, number, number], 
  maxDistance: number
): ImageData => {
  // Create a copy of the image data to avoid modifying the original
  const processedImageData = new ImageData(
    new Uint8ClampedArray(imageData.data), 
    imageData.width, 
    imageData.height
  );
  
  const data = processedImageData.data;
  
  // Process each pixel
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    const dist = colorDistance([r, g, b], accentColorRgb);
    
    if (dist < maxDistance) {
      // factor: 0 (exact match) -> 1 (at threshold)
      const factor = dist / maxDistance;
      data[i + 3] = Math.round(a * factor);
    }
  }
  
  return processedImageData;
};

// Worker message handler
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, imageData, accentColor, maxDistance, requestId } = event.data;
  
  try {
    if (type === 'PROCESS_IMAGE') {
      // Validate input data
      if (!imageData || !accentColor || typeof maxDistance !== 'number' || typeof requestId !== 'number') {
        throw new Error('Invalid input parameters for image processing');
      }
      
      if (accentColor.length !== 3 || !accentColor.every(c => typeof c === 'number' && c >= 0 && c <= 255)) {
        throw new Error('Invalid accent color format - expected RGB array with values 0-255');
      }
      
      // Process the image data
      const processedImageData = processImageData(imageData, accentColor, maxDistance);
      
      // Send the processed data back to main thread
      const response: ImageProcessingResponse = {
        type: 'IMAGE_PROCESSED',
        processedImageData,
        success: true,
        requestId
      };
      
      self.postMessage(response);
    } else {
      throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    // Send error response back to main thread
    const errorResponse: ImageProcessingError = {
      type: 'IMAGE_PROCESSING_ERROR',
      error: error instanceof Error ? error.message : 'Unknown error occurred during image processing',
      success: false,
      requestId: requestId || -1
    };
    
    self.postMessage(errorResponse);
  }
};

// Export for TypeScript module resolution
export {};