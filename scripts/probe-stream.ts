// ABOUTME: Streaming confirmation — consumes the Kiro runtime response for a couple of adaptive
// ABOUTME: payloads and prints the decoded content so we know 200 means "honored", not just "accepted".

import { randomUUID } from "node:crypto";
import { getKiroCliCredentials, getKiroCliCredentialsAllowExpired } from "../src/kiro-cli.js";
import { endpointForApiRegion, extractRegionFromProfileArn, managementEndpointForApiRegion } from "../src/models.js";
import { getEnvState } from "../src/transform.js";

const MODEL_ID = "claude-sonnet-4.6";

function req(profileArn: string, adaptive: any): any {
  const r: any = {
    conversationState: {
      chatTriggerType: "MANUAL",
      agentTaskType: "vibe",
      conversationId: randomUUID(),
      currentMessage: {
        userInputMessage: {
          content: "Reply with exactly: OK-ADAPTIVE-STREAM",
          modelId: MODEL_ID,
          origin: "KIRO_CLI",
          userInputMessageContext: { envState: getEnvState() },
        },
      },
    },
    profileArn,
  };
  if (adaptive) r.additionalModelRequestFields = adaptive;
  return r;
}

function ua(): string {
  return `aws-sdk-rust/1.3.15 ua/2.1 api/codewhispererstreaming/0.1.16551 os/windows lang/rust/1.92.0 exec-env/AmazonQ-For-CLI Version/2.6.1 app/AmazonQ-For-CLI`;
}

async function run(label: string, endpoint: string, token: string, body: any): Promise<void> {
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
      "x-amz-user-agent": ua(),
      "user-agent": ua(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.log(`${label}: ${res.status} ${await res.text()}`);
    return;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const text = buf.toString("latin1");
  const contents = [...text.matchAll(/"content":"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]).join("");
  const hasErr = /Exception|REQUEST_BODY_INVALID|error/i.test(text);
  console.log(`${label}: 200  bytes=${buf.length}  content="${contents.slice(0, 120)}"  errMarker=${hasErr}`);
}

async function main(): Promise<void> {
  const creds = getKiroCliCredentials() ?? getKiroCliCredentialsAllowExpired();
  if (!creds?.access) {
    console.error("No creds");
    process.exit(2);
  }
  const region = creds.region || extractRegionFromProfileArn(creds.profileArn) || "us-east-1";
  const endpoint = endpointForApiRegion(region);
  const mgmt = managementEndpointForApiRegion(region);
  let profileArn = creds.profileArn ?? "";
  if (!profileArn) {
    const r = await fetch(mgmt, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.0",
        Authorization: `Bearer ${creds.access}`,
        "X-Amz-Target": "AmazonCodeWhispererService.ListAvailableProfiles",
      },
      body: JSON.stringify({ maxResults: 10 }),
    });
    if (r.ok) profileArn = (await r.json())?.profiles?.[0]?.arn ?? "";
  }

  await run("effort-only", endpoint, creds.access, req(profileArn, { output_config: { effort: "medium" } }));
  await new Promise((r) => setTimeout(r, 500));
  await run(
    "full       ",
    endpoint,
    creds.access,
    req(profileArn, {
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort: "medium" },
      max_tokens: 64000,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
