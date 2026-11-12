export type Route =
  | {
      kind:
        | "media" | "custom" | "peer" | "home"
        | "projects"
        | "settings"
        | "shares"
        | "tabular-home"
        | "not-found";
    }
  | { kind: "image"; id: string; step: "data" | "train" | "predict" | "evolve" }
  | { kind: "tabular"; id: string; step: "data" | "train" | "predict" }
  | { kind: "receive"; id: string; secret: string };
export function parseRoute(input: string): Route {
  const value = input.startsWith("#") ? input.slice(1) : input;
  if (value === "" || value === "/") return { kind: "home" };
  if(value==='/media')return {kind:'media'};
  if(value==='/custom')return {kind:'custom'};
  if(value==='/peer')return {kind:'peer'};
  if (value === "/projects") return { kind: "projects" };
  if (value === "/settings") return { kind: "settings" };
  if (value === "/shares") return { kind: "shares" };
  if (value === "/tabular") return { kind: "tabular-home" };
  const image = value.match(
    /^\/projects\/([A-Za-z0-9_-]{1,100})(?:\/(train|predict|evolve))?$/,
  );
  if (image)
    return {
      kind: "image",
      id: image[1],
      step: (image[2] ?? "data") as "data" | "train" | "predict" | "evolve",
    };
  const table = value.match(
    /^\/tabular\/([A-Za-z0-9_-]{1,100})(?:\/(train|predict))?$/,
  );
  if (table)
    return {
      kind: "tabular",
      id: table[1],
      step: (table[2] ?? "data") as "data" | "train" | "predict",
    };
  const receive = value.match(
    /^\/receive\/([A-Za-z0-9_-]{32})(?:\/([A-Za-z0-9_-]{43}))?$/,
  );
  if (receive)
    return { kind: "receive", id: receive[1], secret: receive[2] ?? "" };
  return { kind: "not-found" };
}
export function routeTitle(route: Route) {
  switch (route.kind) {
    case "media":return "Text / audio / video";
    case "custom":return "Custom models";
    case "peer":return "Peer transfer";
    case "home":
      return "Overview";
    case "projects":
      return "My projects";
    case "settings":
      return "Privacy & storage";
    case "shares":
      return "Encrypted shares";
    case "receive":
      return "Receive a model";
    case "tabular-home":
    case "tabular":
      return "CSV studio";
    case "image":
      return "Image studio";
    default:
      return "Page not found";
  }
}
