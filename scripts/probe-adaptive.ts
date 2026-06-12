// ABOUTME: Live matrix probe — isolates the REQUEST_BODY_INVALID cause and tests each adaptive
// ABOUTME: (shape × field-set) combination against the real Kiro runtime for claude-sonnet-4.6:medium.
//
// Not part of the build/test surface. Run with:
//   npx esbuild scripts/probe-adaptive.ts --bundle --platform=node --format=esm --outfile=scripts/probe-adaptive.mjs --packages=bundle
//   node scripts/probe-adaptive.mjs

import { appendFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { getKiroCliCredentials, getKiroCliCredentialsAllowExpired } from "../src/kiro-cli.js";
import { endpointForApiRegion, extractRegionFromProfileArn, managementEndpointForApiRegion } from "../src/models.js";

const LOG = "logs/kiro-adaptive-thinking.log";
const MODEL_ID = "claude-sonnet-4.6";
const EFFORT = "medium";
const MAX_TOKENS = 64000;

type Shape = "top-level-wrapper" | "top-level-direct" | "user-input-message" | "user-input-context";
type FieldSet = "effort-only" | "full";

const effortOnly = () => ({ output_config: { effort: EFFORT } });
const full = () => ({
  thinking: { type: "adaptive", display: "summarized" },
  output_config: { effort: EFFORT },
  max_tokens: MAX_TOKENS,
});

interface BaseOpts {
  os?: string;
  withContinuation?: boolean;
}

function baseRequest(profileArn: string, opts: BaseOpts = {}): any {
  const cs: any = {
    chatTriggerType: "MANUAL",
    agentTaskType: "vibe",
    conversationId: randomUUID(),
    currentMessage: {
      userInputMessage: {
        content: "Reply with the single word OK.",
        modelId: MODEL_ID,
        origin: "KIRO_CLI",
        userInputMessageContext: {
          envState: {
            operatingSystem: opts.os ?? "windows",
            currentWorkingDirectory: process.cwd(),
          },
        },
      },
    },
  };
  if (opts.withContinuation) cs.agentContinuationId = randomUUID();
  return { conversationState: cs, ...(profileArn ? { profileArn } : {}) };
}

function applyShape(request: any, payload: any, shape: Shape): void {
  const uim = request.conversationState.currentMessage.userInputMessage;
  switch (shape) {
    case "top-level-wrapper":
      request.additionalModelRequestFields = payload;
      break;
    case "top-level-direct":
      Object.assign(request, payload);
      break;
    case "user-input-message":
      uim.additionalModelRequestFields = payload;
      break;
    case "user-input-context":
      uim.userInputMessageContext.additionalModelRequestFields = payload;
      break;
  }
}

function ua(): string {
  const mid = randomUUID().replace(/-/g, "");
  return `aws-sdk-rust/1.3.15 ua/2.1 api/codewhispererstreaming/0.1.16551 os/windows lang/rust/1.92.0 exec-env/AmazonQ-For-CLI Version/2.6.1 md/appVersion-2.6.1-${mid} app/AmazonQ-For-CLI`;
}

async function post(endpoint: string, token: string, request: any): Promise<{ status: number; reason: string }> {
  const u = ua();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.0",
      Accept: "application/vnd.amazon.eventstream",
      Authorization: `Bearer ${token}`,
      "X-Amz-Target": "AmazonCodeWhispererStreamingService.GenerateAssistantResponse",
      "x-amzn-codewhisperer-optout": "false",
      "amz-sdk-invocation-id": randomUUID(),
      "amz-sdk-request": "attempt=1; max=3",
      "x-amz-user-agent": u,
      "user-agent": u,
    },
    body: JSON.stringify(request),
  });
  if (res.ok) {
    try {
      await res.body?.cancel();
    } catch {
      /* ignore */
    }
    return { status: res.status, reason: "OK (accepted)" };
  }
  let body = "";
  try {
    body = await res.text();
  } catch {
    body = "";
  }
  const m = body.match(/"reason"\s*:\s*"([^"]+)"/);
  return { status: res.status, reason: m ? m[1] : body.slice(0, 200) };
}

async function resolveProfileArn(mgmt: string, token: string, fromCreds?: string): Promise<string> {
  if (fromCreds) return fromCreds;
  try {
    const res = await fetch(mgmt, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.0",
        Authorization: `Bearer ${token}`,
        "X-Amz-Target": "AmazonCodeWhispererService.ListAvailableProfiles",
      },
      body: JSON.stringify({ maxResults: 10 }),
    });
    if (res.ok) {
      const j: any = await res.json();
      return j?.profiles?.[0]?.arn ?? "";
    }
  } catch {
    /* ignore */
  }
  return "";
}

async function main(): Promise<void> {
  mkdirSync("logs", { recursive: true });
  const creds = getKiroCliCredentials() ?? getKiroCliCredentialsAllowExpired();
  if (!creds?.access) {
    console.error("No kiro-cli credentials found. Log in via kiro-cli or OMP first.");
    process.exit(2);
  }
  const region = creds.region || extractRegionFromProfileArn(creds.profileArn) || "us-east-1";
  const endpoint = endpointForApiRegion(region);
  const mgmt = managementEndpointForApiRegion(region);
  const profileArn = await resolveProfileArn(mgmt, creds.access, creds.profileArn);

  const header = [
    "",
    "=".repeat(72),
    `ADAPTIVE MATRIX PROBE  ${new Date().toISOString()}`,
    `model=${MODEL_ID} effort=${EFFORT} region=${region} endpoint=${endpoint}`,
    `profileArn=${profileArn || "(none)"}`,
    "=".repeat(72),
  ].join("\n");
  console.log(header);

  const results: string[] = [];
  const record = async (label: string, request: any) => {
    await new Promise((r) => setTimeout(r, 350));
    const r = await post(endpoint, creds.access, request);
    const line = `  ${label.padEnd(40)} -> ${r.status} ${r.reason}`;
    console.log(line);
    results.push(line);
  };

  results.push("-- isolation: what makes the request valid? --");
  console.log("-- isolation --");
  await record("os=windows, no adaptive, no continuation", baseRequest(profileArn, { os: "windows" }));
  await record("os=win32,   no adaptive (suspect)", baseRequest(profileArn, { os: "win32" }));
  await record("os=windows + agentContinuationId", baseRequest(profileArn, { os: "windows", withContinuation: true }));

  results.push("-- matrix on corrected base (os=windows, no continuation) --");
  console.log("-- matrix (os=windows) --");
  const fieldSets: Record<FieldSet, () => any> = { "effort-only": effortOnly, full };
  const shapes: Shape[] = ["top-level-wrapper", "top-level-direct", "user-input-message", "user-input-context"];
  for (const fs of Object.keys(fieldSets) as FieldSet[]) {
    for (const shape of shapes) {
      const req = baseRequest(profileArn, { os: "windows" });
      applyShape(req, fieldSets[fs](), shape);
      await record(`${fs} | ${shape}`, req);
    }
  }

  appendFileSync(LOG, `${header}\n${results.join("\n")}\n`);
  console.log(`\nLogged to ${LOG}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
