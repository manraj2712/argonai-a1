export interface RawRgbImage {
  data: Uint8Array;
  width: number;
  height: number;
}

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedFace {
  box: FaceBox;
  score: number;
}

export interface FaceDetector {
  /** Boxes are in the pixel coordinates of the image passed in. */
  detect(image: RawRgbImage): Promise<DetectedFace[]>;
}
