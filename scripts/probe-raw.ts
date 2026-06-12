// ABOUTME: Raw-stream probe — sends a reasoning-heavy prompt at effort=xhigh and dumps every
// ABOUTME: distinct top-level JSON key + any reasoning/thinking markers found on the wire.

import { randomUUID } from "node:crypto";
import { getKiroCliCredentials, getKiroCliCredentialsAllowExpired } from "../src/kiro-cli.js";
import { endpointForApiRegion, extractRegionFromProfileArn, managementEndpointForApiRegion } from "../src/models.js";
import { getEnvState } from "../src/transform.js";

const MODEL_ID = "claude-sonnet-4.6";
const PROMPT =
  "Show your full step-by-step reasoning, then answer: I have 12 identical coins, exactly one is " +
  "counterfeit (heavier or lighter). Using a balance scale only 3 times, give a strategy that always " +
  "identifies the fake and whether it is heavy or light. Explain every branch in detail.";

function ua(): string {
  return `aws-sdk-rust/1.3.15 ua/2.1 api/codewhispererstreaming/0.1.16551 os/windows lang/rust/1.92.0 exec-env/AmazonQ-For-CLI Version/2.6.1 app/AmazonQ-For-CLI`;
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

  const body = {
    conversationState: {
      chatTriggerType: "MANUAL",
      agentTaskType: "vibe",
      conversationId: randomUUID(),
      currentMessage: {
        userInputMessage: {
          content: PROMPT,
          modelId: MODEL_ID,
          origin: "KIRO_CLI",
          userInputMessageContext: { envState: getEnvState() },
        },
      },
    },
    profileArn,
    additionalModelRequestFields: {
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort: "max" },
      max_tokens: 64000,
    },
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.0",
      Accept: "application/vnd.amazon.eventstream",
      Authorization: `Bearer ${creds.access}`,
      "X-Amz-Target": "AmazonCodeWhispererStreamingService.GenerateAssistantResponse",
      "x-amzn-codewhisperer-optout": "false",
      "amz-sdk-invocation-id": randomUUID(),
      "amz-sdk-request": "attempt=1; max=3",
      "x-amz-user-agent": ua(),
      "user-agent": ua(),
    },
    body: JSON.stringify(body),
  });
  console.log("status", res.status);
  if (!res.ok) {
    console.log(await res.text());
    return;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const text = buf.toString("latin1");

  // All distinct top-level JSON keys that begin an event object: {"<key>":
  const keys = new Set<string>();
  for (const m of text.matchAll(/\{"([a-zA-Z]+)":/g)) keys.add(m[1]);
  console.log("bytes:", buf.length);
  console.log("distinct {\"key\": markers on the wire:", [...keys].sort().join(", "));
  console.log("contains 'reason':", /reason/i.test(text), " contains 'think':", /think/i.test(text));

  // Reconstruct the concatenated content payloads (what the extension would render).
  const content = [...text.matchAll(/"content":"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]).join("");
  console.log("\n--- reconstructed content (first 600 chars) ---");
  console.log(content.slice(0, 600).replace(/\\n/g, "\n"));
  console.log(`\n--- content length: ${content.length} chars ---`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
