declare module "jsqr" {
  export interface LocatorPoint {
    x: number;
    y: number;
  }

  export interface QRCode {
    binaryData: Uint8ClampedArray;
    data: string;
    chunks: unknown[];
    location: {
      topLeftCorner: LocatorPoint;
      topRightCorner: LocatorPoint;
      bottomRightCorner: LocatorPoint;
      bottomLeftCorner: LocatorPoint;
      topLeftFinderPattern: LocatorPoint;
      topRightFinderPattern: LocatorPoint;
      bottomLeftFinderPattern: LocatorPoint;
      bottomRightAlignmentPattern?: LocatorPoint;
    };
  }

  function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options?: { inversionAttempts?: string },
  ): QRCode | null;

  export default jsQR;
}
