/**
 * Utility functions for client-side image processing, compression, and dimension normalization.
 * Prevents HTTP 413 (Payload Too Large) errors and optimizes mobile upload performance.
 */

/**
 * Compresses an image file or data URL using an offscreen HTML5 canvas.
 * 
 * @param file The image File object from an <input type="file">
 * @param maxWidth The maximum width constraint in pixels (default: 1280)
 * @param maxHeight The maximum height constraint in pixels (default: 720)
 * @param quality JPEG compression quality between 0.1 and 1.0 (default: 0.8)
 * @returns A promise resolving to a compressed base64 JPEG data URL
 */
export async function compressImage(
  file: File,
  maxWidth = 1280,
  maxHeight = 720,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Basic sanity check on file type
    if (!file.type.startsWith('image/')) {
      return reject(new Error('File provided is not a valid image'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file data'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image data'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio while bounding within maxWidth & maxHeight
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Prevent zero-dimension canvas
        width = Math.max(1, width);
        height = Math.max(1, height);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // If 2D context is somehow unavailable, fallback to raw reader string
          resolve(reader.result as string);
          return;
        }

        // Smooth image rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to efficient JPEG data URL
        try {
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } catch {
          resolve(reader.result as string);
        }
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}
