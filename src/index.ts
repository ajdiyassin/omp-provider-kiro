import type { Api, Model, OAuthCredentials } from "@oh-my-pi/pi-ai";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { getKiroCliCredentials } from "./kiro-cli.js";
import { endpointForApiRegion, getCachedModels, kiroModels, resolveApiRegion } from "./models.js";
import type { KiroCredentials } from "./oauth.js";
import { loginKiro, refreshKiroToken } from "./oauth.js";
import { streamKiro } from "./stream.js";
import { fetchKiroUsage } from "./usage.js";

export default function ompKiroProvider(pi: ExtensionAPI) {
  pi.registerProvider("kiro", {
    baseUrl: endpointForApiRegion("us-east-1"),
    api: "kiro-api",
    // `thinking.efforts` uses pi-catalog's `Effort` const-enum nominally; our
    // values are the matching strings, so cast at the boundary.
    models: kiroModels as unknown as Parameters<ExtensionAPI["registerProvider"]>[1]["models"],
    oauth: {
      name: "Kiro",
      login: loginKiro,
      refreshToken: refreshKiroToken,
      getApiKey: (cred: OAuthCredentials) => cred.access,
      getCliCredentials: getKiroCliCredentials,
      modifyModels: (models: Model<Api>[], cred: OAuthCredentials) => {
        const apiRegion = resolveApiRegion((cred as KiroCredentials).region);
        const cachedKiro = getCachedModels(apiRegion);
        const nonKiro = models.filter((m: Model<Api>) => m.provider !== "kiro");
        const modifiedKiro = cachedKiro.map((m) => ({
          ...m,
          baseUrl: endpointForApiRegion(apiRegion),
        }));
        return [...nonKiro, ...modifiedKiro];
      },
      fetchUsage: fetchKiroUsage,
    } as any,
    streamSimple: streamKiro,
  });
}
