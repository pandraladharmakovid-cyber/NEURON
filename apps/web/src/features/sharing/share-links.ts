import { unbase64url } from "./crypto";
export const validShareId = (id: string) => /^[A-Za-z0-9_-]{32}$/.test(id);
export function shareLink(origin: string, id: string, secret: string) {
  if (!validShareId(id)) throw new Error("Invalid share reference.");
  unbase64url(secret, 32);
  const url = new URL(origin);
  if (!["https:", "http:"].includes(url.protocol) || url.origin !== origin)
    throw new Error("Invalid application origin.");
  return `${origin}/#/receive/${id}/${secret}`;
}
export function parseShareLink(value: string) {
  const url = new URL(value);
  const match = url.hash.match(
    /^#\/receive\/([A-Za-z0-9_-]{32})\/([A-Za-z0-9_-]{43})$/,
  );
  if (
    !match ||
    url.username ||
    url.password ||
    url.search ||
    url.pathname !== "/" ||
    !["https:", "http:"].includes(url.protocol)
  )
    throw new Error("Invalid NEURON share link.");
  unbase64url(match[2], 32);
  return { id: match[1], secret: match[2], origin: url.origin };
}