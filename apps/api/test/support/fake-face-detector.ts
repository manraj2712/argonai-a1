import type {
  DetectedFace,
  FaceDetector,
  RawRgbImage,
} from '../../src/modules/processing/faces/face-detector.js';

/** Reports one face covering the middle third of whatever image it's given. */
export class CentredFaceDetector implements FaceDetector {
  detect(image: RawRgbImage): Promise<DetectedFace[]> {
    return Promise.resolve([
      {
        score: 0.99,
        box: {
          x: image.width / 3,
          y: image.height / 3,
          width: image.width / 3,
          height: image.height / 3,
        },
      },
    ]);
  }
}
