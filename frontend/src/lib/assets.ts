export function resolveImagePath(path: string | null | undefined) {
  if (!path) return null;
  return path.startsWith("/") ? path : `/${path}`;
}
