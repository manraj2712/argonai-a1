declare module 'heic-decode' {
  export interface DecodedImage {
    width: number;
    height: number;
    data: Uint8ClampedArray;
  }

  export interface LazyImage {
    width: number;
    height: number;
    decode(): Promise<DecodedImage>;
  }

  export interface LazyImageList extends Array<LazyImage> {
    dispose(): void;
  }

  export interface DecodeOptions {
    buffer: ArrayBufferLike | Uint8Array;
  }

  export interface HeicDecode {
    (options: DecodeOptions): Promise<DecodedImage>;
    all(options: DecodeOptions): Promise<LazyImageList>;
  }

  const decode: HeicDecode;
  export default decode;
}
