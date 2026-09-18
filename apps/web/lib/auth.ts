export const DEVICE_HEADER = 'x-ftr-device';

export function deviceIdFrom(request: Request): string | null {
  const id = request.headers.get(DEVICE_HEADER)?.trim();
  return id && id.length >= 8 ? id : null;
}
