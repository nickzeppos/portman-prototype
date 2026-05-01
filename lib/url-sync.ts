// Update the address bar without invoking Next's router. Used by pages that
// mirror local state to the URL purely for shareability and never read the
// URL back post-mount. Bypassing the router avoids a static-export
// navigation path that intermittently scrolls to the top.
//
// usePathname() returns the path without basePath, and replaceState writes
// what we pass literally, so we re-prepend NEXT_PUBLIC_BASE_PATH (empty in
// dev / on custom-domain deploys) to keep the URL on the deployed subpath.
export function replaceUrl(pathname: string, params: URLSearchParams): void {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const qs = params.toString();
  const path = qs ? `${pathname}?${qs}` : pathname;
  window.history.replaceState(null, '', `${basePath}${path}`);
}
