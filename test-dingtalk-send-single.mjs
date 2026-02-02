import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^"|"$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

const clientId = process.env.DINGTALK_CLIENT_ID;
const clientSecret = process.env.DINGTALK_CLIENT_SECRET;
const robotCode = process.env.DINGTALK_ROBOT_CODE;
const userId = process.env.DINGTALK_USER_ID;
const content = process.env.DINGTALK_TEXT || "Hello from DingTalk standalone test.";

if (!clientId || !clientSecret || !robotCode || !userId) {
  console.error(
    "Missing DINGTALK_CLIENT_ID / DINGTALK_CLIENT_SECRET / DINGTALK_ROBOT_CODE / DINGTALK_USER_ID",
  );
  process.exit(1);
}

async function getAccessToken() {
  const url = `https://oapi.dingtalk.com/gettoken?appkey=${encodeURIComponent(
    clientId,
  )}&appsecret=${encodeURIComponent(clientSecret)}`;

  const res = await fetch(url, { method: "GET" });
  const data = await res.json();

  if (data.errcode !== 0 || !data.access_token) {
    throw new Error(`Failed to get access token: ${data.errmsg} (${data.errcode})`);
  }

  return data.access_token;
}

async function sendSingleChatMessage() {
  const accessToken = await getAccessToken();
  const url = "https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend";

  const body = {
    robotCode,
    userIds: [userId],
    msgKey: "sampleText",
    msgParam: JSON.stringify({ content }),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-acs-dingtalk-access-token": accessToken,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (data.errcode && data.errcode !== 0) {
    throw new Error(`Send failed: ${data.errmsg} (${data.errcode})`);
  }

  console.log("[dingtalk] single chat sent.");
}

sendSingleChatMessage().catch((err) => {
  console.error("[dingtalk] send failed:", err);
  process.exit(1);
});
