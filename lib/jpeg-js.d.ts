declare module "jpeg-js" {
  export function encode(
    image: { data: Uint8Array | Uint8ClampedArray; width: number; height: number },
    quality?: number,
  ): { data: Uint8Array; width: number; height: number };
}
