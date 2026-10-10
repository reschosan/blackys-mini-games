/** Address of a file in `public/`. The build is served from any folder (`base: './'`), so a file is never addressed from the server root. */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}
