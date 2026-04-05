import { useRef, useEffect, useCallback, useState } from 'react';
import type {
  WorkerResponse,
  ImageProcessingRequest,
  ImageProcessingResponse,
  ImageProcessingError
} from '@/workers/imageProcessor.worker';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const pendingPromisesRef = useRef<Map<number, {
    resolve: (imageData: ImageData) => void;
    reject: (error: Error) => void;
  }>>(new Map());
  const requestIdRef = useRef(0);

  const initializeWorker = useCallback(() => {
    if (!workerRef.current) {
      try {
        workerRef.current = new Worker(
          new URL('../workers/imageProcessor.worker.ts', import.meta.url),
          { type: 'module' }
        );

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

          pendingPromisesRef.current.delete(requestId);
          setIsProcessing(pendingPromisesRef.current.size > 0);
        };

        workerRef.current.onerror = (error) => {
          console.error('Image processing worker error:', error);
          pendingPromisesRef.current.forEach((promise) => {
            promise.reject(new Error('Worker encountered an error'));
          });
          pendingPromisesRef.current.clear();
          setIsProcessing(false);
        };

      } catch (error) {
        console.error('Failed to initialize image processing worker:', error);
        throw error;
      }
    }
  }, []);

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
        setIsProcessing(true);

        pendingPromisesRef.current.set(requestId, { resolve, reject });

        const message: ImageProcessingRequest & { requestId: number } = {
          type: 'PROCESS_IMAGE',
          imageData,
          accentColor,
          maxDistance,
          requestId
        };

        workerRef.current.postMessage(message);

        setTimeout(() => {
          const pendingPromise = pendingPromisesRef.current.get(requestId);
          if (pendingPromise) {
            pendingPromisesRef.current.delete(requestId);
            setIsProcessing(pendingPromisesRef.current.size > 0);
            reject(new Error('Image processing timeout'));
          }
        }, 10000);

      } catch (error) {
        setIsProcessing(false);
        reject(error instanceof Error ? error : new Error('Unknown error'));
      }
    });
  }, [initializeWorker]);

  useEffect(() => {
    const pendingPromises = pendingPromisesRef.current;
    return () => {
      if (workerRef.current) {
        pendingPromises.forEach((promise) => {
          promise.reject(new Error('Component unmounted'));
        });
        pendingPromises.clear();

        workerRef.current.terminate();
        workerRef.current = null;
        setIsProcessing(false);
      }
    };
  }, []);

  return {
    processImage,
    isProcessing
  };
};
