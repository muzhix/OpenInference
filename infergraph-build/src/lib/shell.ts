/** postMessage bridge to inference /build editor.html shell. */

export function notifyNavigate(path: string): void {
  if (window.parent === window) return;
  window.parent.postMessage({ type: "navigate", path }, "*");
}

export function notifySetTitle(title: string): void {
  if (window.parent === window) return;
  window.parent.postMessage({ type: "setTitle", title }, "*");
  document.title = title;
}
