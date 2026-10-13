import { createRequire } from 'node:module';
import path from 'node:path';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm';
import * as faceapi from '@vladmandic/face-api/dist/face-api.node-wasm.js';
import type { DetectedFace, FaceDetector, RawRgbImage } from './face-detector.js';

const require = createRequire(import.meta.url);
const MODEL_DIR = path.join(
  path.dirname(require.resolve('@vladmandic/face-api/package.json')),
  'model',
);

/**
 * SSD MobileNet v1 on the tfjs WASM backend, so there's no native build step.
 * face-api's bundle loads the same @tensorflow/tfjs instance we import here.
 * Don't call tf.setWasmPaths() with a filesystem path: Node's fetch rejects it, and the
 * backend already finds its .wasm files next to itself.
 */
export class FaceApiDetector implements FaceDetector {
  private constructor(private readonly options: faceapi.SsdMobilenetv1Options) {}

  static async create(minConfidence: number): Promise<FaceApiDetector> {
    await tf.setBackend('wasm');
    await tf.ready();
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_DIR);
    return new FaceApiDetector(
      new faceapi.SsdMobilenetv1Options({ minConfidence, maxResults: 20 }),
    );
  }

  async detect(image: RawRgbImage): Promise<DetectedFace[]> {
    const tensor = tf.tensor3d(image.data, [image.height, image.width, 3], 'int32');
    try {
      const detections = await faceapi.detectAllFaces(tensor, this.options);
      return detections.map((detection) => ({
        box: {
          x: detection.box.x,
          y: detection.box.y,
          width: detection.box.width,
          height: detection.box.height,
        },
        score: detection.score,
      }));
    } finally {
      tensor.dispose();
    }
  }
}
