import { useEffect, useState } from 'react';
import smartcrop from 'smartcrop';

interface CropResult {
  x: number;
  y: number;
}

/**
 * Hook to calculate optimal crop position for an image using smartcrop.js
 * Returns object-position values (percentage from top-left)
 */
export function useSmartCrop(
  imageUrl: string | null,
  targetWidth: number = 1,
  targetHeight: number = 1
): { objectPosition: string | null; isLoading: boolean } {
  const [objectPosition, setObjectPosition] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!imageUrl) {
      setObjectPosition(null);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const calculateCrop = async () => {
      setIsLoading(true);
      try {
        // Wait for image to load
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = imageUrl;
        });

        if (cancelled) return;

        // Run smartcrop algorithm
        const result = await smartcrop.crop(img, {
          width: targetWidth,
          height: targetHeight,
          minScale: 1.0,
        });

        if (cancelled) return;

        const crop = result.topCrop;

        // Calculate the center of the crop region
        const centerX = crop.x + crop.width / 2;
        const centerY = crop.y + crop.height / 2;

        // Convert to percentages for object-position
        const xPercent = (centerX / img.naturalWidth) * 100;
        const yPercent = (centerY / img.naturalHeight) * 100;

        setObjectPosition(`${xPercent}% ${yPercent}%`);
      } catch (error) {
        console.error('Smartcrop error:', error);
        // Fallback to default positioning
        setObjectPosition('center 40%');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    calculateCrop();

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl, targetWidth, targetHeight]);

  return { objectPosition, isLoading };
}
