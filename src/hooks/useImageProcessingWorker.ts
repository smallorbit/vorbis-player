import { useRef, useEffect, useCallback } from 'react';
import type { 
  WorkerResponse, 
  ImageProcessingRequest, 
  ImageProcessingResponse, 
  ImageProcessingError 
} from '../workers/imageProcessor.worker';

interface UseImageProcessingWorkerReturn {
  processImage: (
    imageData: ImageData, 
    accentColor: [number, number, number], 
    maxDistance?: number
  ) => Promise<ImageData>;
  isProcessing: boolean;
}

export const useImageProcessingWorker = (): UseImageProcessingWorkerReturn => {
  const workerRef = useRef<Worker | null>(null);
  const isProcessingRef = useRef(false);
  const pendingPromisesRef = useRef<Map<number, {
    resolve: (imageData: ImageData) => void;
    reject: (error: Error) => void;
  }>>(new Map());
  const requestIdRef = useRef(0);

  // Initialize worker on first use
  const initializeWorker = useCallback(() => {
    if (!workerRef.current) {
      try {
        // Create worker from the TypeScript file - Vite will handle compilation
        workerRef.current = new Worker(
          new URL('../workers/imageProcessor.worker.ts', import.meta.url),
          { type: 'module' }
        );

        // Handle worker messages
        workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
          const { type } = event.data;
          const requestId = (event.data as WorkerResponse & { requestId: number }).requestId;
          const pendingPromise = pendingPromisesRef.current.get(requestId);
          
          if (!pendingPromise) {
            console.warn('Received response for unknown request ID:', requestId);
            return;
          }

          if (type === 'IMAGE_PROCESSED') {
            const response = event.data as ImageProcessingResponse;
            pendingPromise.resolve(response.processedImageData);
          } else if (type === 'IMAGE_PROCESSING_ERROR') {
            const response = event.data as ImageProcessingError;
            pendingPromise.reject(new Error(response.error));
          }

          // Clean up
          pendingPromisesRef.current.delete(requestId);
          isProcessingRef.current = pendingPromisesRef.current.size > 0;
        };

        // Handle worker errors
        workerRef.current.onerror = (error) => {
          console.error('Image processing worker error:', error);
          // Reject all pending promises
          pendingPromisesRef.current.forEach((promise) => {
            promise.reject(new Error('Worker encountered an error'));
          });
          pendingPromisesRef.current.clear();
          isProcessingRef.current = false;
        };

      } catch (error) {
        console.error('Failed to initialize image processing worker:', error);
        throw error;
      }
    }
  }, []);

  // Process image function
  const processImage = useCallback(async (
    imageData: ImageData,
    accentColor: [number, number, number],
    maxDistance: number = 60
  ): Promise<ImageData> => {
    return new Promise((resolve, reject) => {
      try {
        initializeWorker();
        
        if (!workerRef.current) {
          throw new Error('Failed to initialize worker');
        }

        const requestId = requestIdRef.current++;
        isProcessingRef.current = true;

        // Store promise resolvers
        pendingPromisesRef.current.set(requestId, { resolve, reject });

        // Send message to worker with request ID
        const message: ImageProcessingRequest & { requestId: number } = {
          type: 'PROCESS_IMAGE',
          imageData,
          accentColor,
          maxDistance,
          requestId
        };

        workerRef.current.postMessage(message);

        // Set a timeout to prevent hanging promises
        setTimeout(() => {
          const pendingPromise = pendingPromisesRef.current.get(requestId);
          if (pendingPromise) {
            pendingPromisesRef.current.delete(requestId);
            isProcessingRef.current = pendingPromisesRef.current.size > 0;
            reject(new Error('Image processing timeout'));
          }
        }, 10000); // 10 second timeout

      } catch (error) {
        isProcessingRef.current = false;
        reject(error instanceof Error ? error : new Error('Unknown error'));
      }
    });
  }, [initializeWorker]);

  // Cleanup worker on unmount
  useEffect(() => {
    const currentWorker = workerRef.current;
    const currentPendingPromises = pendingPromisesRef.current;
    
    return () => {
      if (currentWorker) {
        // Reject all pending promises
        currentPendingPromises.forEach((promise) => {
          promise.reject(new Error('Component unmounted'));
        });
        currentPendingPromises.clear();
        
        // Terminate worker
        currentWorker.terminate();
        workerRef.current = null;
        isProcessingRef.current = false;
      }
    };
  }, []);

  return {
    processImage,
    isProcessing: isProcessingRef.current
  };
};