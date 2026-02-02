import { DWClient, TOPIC_ROBOT, EventAck } from "dingtalk-stream";

const clientId = process.env.DINGTALK_CLIENT_ID;
const clientSecret = process.env.DINGTALK_CLIENT_SECRET;
const debug = process.env.DINGTALK_DEBUG === "1";

if (!clientId || !clientSecret) {
  console.error("Missing DINGTALK_CLIENT_ID or DINGTALK_CLIENT_SECRET.");
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

async function sendMessageViaWebhook({ sessionWebhook, content, atUserIds, isAtAll }) {
  const accessToken = await getAccessToken();
  const body = {
    msgtype: "text",
    text: { content },
    at: { atUserIds: atUserIds || [], isAtAll: Boolean(isAtAll) },
  };

  const res = await fetch(sessionWebhook, {
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
}

async function main() {
  const client = new DWClient({
    clientId,
    clientSecret,
    debug,
  });

  client.registerCallbackListener(TOPIC_ROBOT, async (res) => {
    const robotMsg = JSON.parse(res.data);
    const text = robotMsg?.text?.content || "";

    console.log("[dingtalk] incoming:", {
      conversationId: robotMsg.conversationId,
      conversationType: robotMsg.conversationType,
      senderNick: robotMsg.senderNick,
      senderStaffId: robotMsg.senderStaffId,
      text: text.slice(0, 200),
    });

    try {
      if (robotMsg.sessionWebhook && text) {
        const reply = `echo: ${text}`.slice(0, 500);
        await sendMessageViaWebhook({
          sessionWebhook: robotMsg.sessionWebhook,
          content: reply,
          atUserIds: robotMsg.conversationType === "1" ? [robotMsg.senderStaffId] : undefined,
        });
      }
    } catch (err) {
      console.error("[dingtalk] reply failed:", err);
    } finally {
      client.socketCallBackResponse(res.headers.messageId, {});
    }
  });

  client.registerAllEventListener((message) => {
    if (debug) {
      console.log("[dingtalk] event:", message.type);
    }
    return { status: EventAck.SUCCESS };
  });

  console.log("[dingtalk] connecting...");
  await client.connect();
  console.log("[dingtalk] connected.");
}

main().catch((err) => {
  console.error("[dingtalk] fatal:", err);
  process.exit(1);
});
