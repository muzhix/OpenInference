/** Session params injected by editor.html iframe (?serverUrl=&csrf=). */

export type Session = {
  serverUrl: string;
  csrf: string;
};

export function readSession(): Session {
  const params = new URLSearchParams(window.location.search);
  const serverUrl =
    params.get("serverUrl") ||
    `${window.location.protocol}//${window.location.host}`;
  const csrf = params.get("csrf") || "";
  return { serverUrl: serverUrl.replace(/\/$/, ""), csrf };
}
