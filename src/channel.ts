import {
  DEFAULT_ACCOUNT_ID,
  PAIRING_APPROVED_MESSAGE,
  formatPairingApproveHint,
  type ChannelPlugin,
  type ClawdbotConfig,
} from "openclaw/plugin-sdk";

import { type DingTalkAccountConfig } from "./config.js";
import { DingTalkApiClient } from "./api.js";
import { getDingTalkRuntime } from "./runtime.js";
import { DingTalkStreamClient, type DingTalkIncomingMessage } from "./stream-client.js";

interface ResolvedDingTalkAccount {
  accountId: string;
  enabled: boolean;
  name?: string;
  config: DingTalkAccountConfig;
  clientId: string;
  clientSecret: string;
  robotCode?: string;
}

const meta = {
  id: "dingtalk",
  label: "DingTalk",
  selectionLabel: "DingTalk",
  docsPath: "/channels/dingtalk",
  docsLabel: "dingtalk",
  blurb: "DingTalk enterprise messaging.",
  aliases: ["dingding", "dd"],
  order: 75,
} as const;

const apiClients = new Map<string, DingTalkApiClient>();
const streamClients = new Map<string, DingTalkStreamClient>();

function getApiClient(account: ResolvedDingTalkAccount): DingTalkApiClient {
  const key = account.clientId;
  let client = apiClients.get(key);
  if (!client) {
    client = new DingTalkApiClient({
      clientId: account.clientId,
      clientSecret: account.clientSecret,
    });
    apiClients.set(key, client);
  }
  return client;
}

function resolveDingTalkAccount(cfg: any, accountId?: string): ResolvedDingTalkAccount {
  const id = accountId ?? DEFAULT_ACCOUNT_ID;
  const dingtalkConfig = cfg.channels?.dingtalk ?? {};
  const accountConfig = dingtalkConfig.accounts?.[id] ?? dingtalkConfig;

  return {
    accountId: id,
    name: accountConfig.name ?? "DingTalk",
    enabled: accountConfig.enabled ?? true,
    config: accountConfig,
    clientId: accountConfig.clientId ?? "",
    clientSecret: accountConfig.clientSecret ?? "",
    robotCode: accountConfig.robotCode,
  };
}

async function startStreamClient(account: ResolvedDingTalkAccount): Promise<void> {
  const key = account.clientId;

  if (streamClients.has(key)) {
    console.log(`[dingtalk channel] Stream client already running for account ${account.accountId}`);
    return;
  }

  const client = new DingTalkStreamClient({
    clientId: account.clientId,
    clientSecret: account.clientSecret,
    onMessage: async (message: DingTalkIncomingMessage) => {
      await handleIncomingMessage(account, message);
    },
    onConnected: () => {
      console.log(`[dingtalk channel] Stream connected for account ${account.accountId}`);
    },
    onDisconnected: () => {
      console.log(`[dingtalk channel] Stream disconnected for account ${account.accountId}`);
      streamClients.delete(key);
    },
    onError: (error) => {
      console.error(`[dingtalk channel] Stream error for account ${account.accountId}:`, error);
    },
    debug: false,
  });

  streamClients.set(key, client);
  await client.connect();
}

function stopStreamClient(account: ResolvedDingTalkAccount): void {
  const key = account.clientId;
  const client = streamClients.get(key);
  if (client) {
    client.disconnect();
    streamClients.delete(key);
  }
}

async function handleIncomingMessage(
  account: ResolvedDingTalkAccount,
  message: DingTalkIncomingMessage,
): Promise<void> {
  const runtime = getDingTalkRuntime();

  try {
    const messageText = message.text?.content || "";
    if (!messageText.trim()) {
      console.log("[dingtalk channel] Ignoring empty message");
      return;
    }

    const conversationType = message.conversationType;
    const isGroupChat = conversationType === "2";

    const isBotMentioned = message.atUsers?.some(
      (user) => user.dingtalkId === message.chatbotUserId,
    );

    console.log("[dingtalk channel] Received message:", {
      conversationType: isGroupChat ? "group" : "single",
      from: message.senderNick,
      text: messageText.substring(0, 100),
      mentioned: isBotMentioned,
    });

    const cfg = runtime.config.loadConfig();

    const route = runtime.channel.routing.resolveAgentRoute({
      cfg,
      channel: "dingtalk",
      accountId: account.accountId,
      peer: {
        kind: isGroupChat ? "group" : "dm",
        id: isGroupChat ? message.conversationId : message.senderStaffId,
      },
    });

    const storePath = runtime.channel.session.resolveStorePath(cfg.session?.store, {
      agentId: route.agentId,
    });
    const envelopeOptions = runtime.channel.reply.resolveEnvelopeFormatOptions(cfg);
    const previousTimestamp = runtime.channel.session.readSessionUpdatedAt({
      storePath,
      sessionKey: route.sessionKey,
    });

    const body = runtime.channel.reply.formatInboundEnvelope({
      channel: "DingTalk",
      from: message.senderNick || message.senderStaffId,
      timestamp: message.createAt,
      previousTimestamp,
      envelope: envelopeOptions,
      body: messageText,
      chatType: isGroupChat ? "group" : "direct",
    });

    const dingtalkTo = isGroupChat
      ? `dingtalk:group:${message.conversationId}`
      : `dingtalk:${message.senderStaffId}`;

    const ctxPayload = runtime.channel.reply.finalizeInboundContext({
      Body: body,
      RawBody: messageText,
      CommandBody: messageText,
      From: `dingtalk:${message.senderStaffId}`,
      To: dingtalkTo,
      SessionKey: route.sessionKey,
      AccountId: route.accountId,
      ChatType: isGroupChat ? "group" : "direct",
      ConversationLabel: message.senderNick || message.senderStaffId,
      SenderId: message.senderStaffId,
      Provider: "dingtalk",
      Surface: "dingtalk",
      MessageSid: message.msgId,
      Timestamp: message.createAt,
      OriginatingChannel: "dingtalk",
      OriginatingTo: dingtalkTo,
    });

    await runtime.channel.session.recordInboundSession({
      storePath,
      sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
      ctx: ctxPayload,
      onRecordError: (err: unknown) => {
        console.error(`[dingtalk channel] Failed updating session meta: ${String(err)}`);
      },
    });

    console.log(`[dingtalk channel] Dispatching reply for message from ${message.senderNick}`);

    await runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
      ctx: ctxPayload,
      cfg,
      dispatcherOptions: {
        deliver: async (payload: { text?: string }) => {
          console.log(
            `[dingtalk channel] deliver called for ${message.senderNick}: ${payload.text?.slice(0, 50) || "(no text)"}`,
          );

          if (!payload.text) {
            console.error("[dingtalk channel] deliver called but payload.text is empty");
            return;
          }

          const apiClient = getApiClient(account);
          const replyText = payload.text;

          if (message.sessionWebhook) {
            console.log("[dingtalk channel] Using sessionWebhook");
            await apiClient.sendMessageViaWebhook({
              sessionWebhook: message.sessionWebhook,
              content: replyText,
              atUserIds: isGroupChat ? undefined : [message.senderStaffId],
            });
            console.log("[dingtalk channel] Message sent via webhook successfully");
          } else if (account.robotCode) {
            console.log("[dingtalk channel] Using robotCode API");
            await apiClient.sendSingleChatMessage({
              robotCode: account.robotCode,
              userId: message.senderStaffId,
              content: replyText,
            });
            console.log("[dingtalk channel] Message sent via robotCode API successfully");
          } else {
            console.error("[dingtalk channel] No webhook or robotCode available for sending");
          }
        },
        onError: (err: unknown, info: { kind: string }) => {
          console.error(`[dingtalk channel] ${info.kind} reply failed: ${String(err)}`);
        },
      },
    });

    console.log(`[dingtalk channel] Reply dispatching completed for ${message.senderNick}`);
  } catch (error) {
    console.error("[dingtalk channel] Error handling incoming message:", error);
  }
}

export const dingtalkPlugin: ChannelPlugin<ResolvedDingTalkAccount> = {
  id: "dingtalk",
  meta: {
    ...meta,
  },
  pairing: {
    idLabel: "dingtalkUserId",
    normalizeAllowEntry: (entry: string) => entry.replace(/^dingtalk:/i, ""),
    notifyApproval: async ({ id, accountId }: { id: string; accountId: string }) => {
      const cfg = getDingTalkRuntime().config.loadConfig();
      const account = resolveDingTalkAccount(cfg, accountId);
      const client = getApiClient(account);

      if (!account.robotCode) {
        console.warn(
          "[dingtalk channel] robotCode not configured, cannot send pairing approval via single chat",
        );
        return;
      }

      await client.sendSingleChatMessage({
        robotCode: account.robotCode,
        userId: id,
        content: PAIRING_APPROVED_MESSAGE,
      });
    },
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    reactions: false,
    threads: false,
    media: false,
    nativeCommands: false,
  },
  reload: { configPrefixes: ["channels.dingtalk"] },
  configSchema: {
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        enabled: { type: "boolean" },
        clientId: { type: "string" },
        clientSecret: { type: "string" },
        robotCode: { type: "string" },
        dm: {
          type: "object",
          additionalProperties: false,
          properties: {
            policy: { type: "string", enum: ["open", "pairing", "allowlist"] },
            allowFrom: { type: "array", items: { oneOf: [{ type: "string" }, { type: "number" }] } },
          },
        },
        groupPolicy: { type: "string", enum: ["open", "allowlist", "disabled"] },
        groups: {
          type: "object",
          additionalProperties: {
            type: "object",
            additionalProperties: false,
            properties: {
              enabled: { type: "boolean" },
              requireMention: { type: "boolean" },
              toolPolicy: { type: "string" },
            },
          },
        },
        accounts: { type: "object", additionalProperties: true },
      },
    },
  },
  config: {
    listAccountIds: (cfg) => {
      const dingtalkConfig = cfg.channels?.dingtalk ?? {};
      const accounts = dingtalkConfig.accounts ?? {};
      return Object.keys(accounts).length > 0 ? Object.keys(accounts) : [DEFAULT_ACCOUNT_ID];
    },
    resolveAccount: (cfg, accountId) => resolveDingTalkAccount(cfg, accountId),
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    setAccountEnabled: ({ cfg, accountId, enabled }) => {
      if (!cfg.channels) cfg.channels = {};
      if (!cfg.channels.dingtalk) cfg.channels.dingtalk = {};

      if (accountId === DEFAULT_ACCOUNT_ID) {
        cfg.channels.dingtalk.enabled = enabled;
      } else {
        if (!cfg.channels.dingtalk.accounts) cfg.channels.dingtalk.accounts = {};
        if (!cfg.channels.dingtalk.accounts[accountId]) {
          cfg.channels.dingtalk.accounts[accountId] = {} as any;
        }
        cfg.channels.dingtalk.accounts[accountId].enabled = enabled;
      }
      return cfg;
    },
    deleteAccount: ({ cfg, accountId }: { cfg: ClawdbotConfig; accountId: string }) => {
      if (accountId === DEFAULT_ACCOUNT_ID) {
        delete cfg.channels?.dingtalk;
      } else {
        delete cfg.channels?.dingtalk?.accounts?.[accountId];
      }
      return cfg;
    },
    isConfigured: (account: ResolvedDingTalkAccount) =>
      Boolean(account.clientId && account.clientSecret),
    describeAccount: (account: ResolvedDingTalkAccount) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.clientId && account.clientSecret),
      clientId: account.clientId,
      robotCode: account.robotCode,
    }),
    resolveAllowFrom: ({ cfg, accountId }) => {
      const account = resolveDingTalkAccount(cfg, accountId);
      return (account.config.dm?.allowFrom ?? []).map((entry) => String(entry));
    },
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.toLowerCase()),
  },
  security: {
    resolveDmPolicy: ({
      cfg,
      accountId,
      account,
    }: {
      cfg: ClawdbotConfig;
      accountId: string;
      account: ResolvedDingTalkAccount;
    }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const useAccountPath = Boolean(cfg.channels?.dingtalk?.accounts?.[resolvedAccountId]);
      const allowFromPath = useAccountPath
        ? `channels.dingtalk.accounts.${resolvedAccountId}.dm.`
        : "channels.dingtalk.dm.";
      const dmConfig = account.config.dm;
      return {
        policy: dmConfig?.policy ?? "pairing",
        allowFrom: dmConfig?.allowFrom ?? [],
        allowFromPath,
        approveHint: formatPairingApproveHint("dingtalk"),
        normalizeEntry: (raw) => raw.replace(/^dingtalk:/i, ""),
      };
    },
    collectWarnings: ({ account, cfg }) => {
      const warnings: string[] = [];
      const defaultGroupPolicy = cfg.channels?.defaults?.groupPolicy;
      const groupPolicy = account.config.groupPolicy ?? defaultGroupPolicy ?? "open";
      const groupsConfigured =
        Boolean(account.config.groups) && Object.keys(account.config.groups ?? {}).length > 0;

      if (groupPolicy === "open") {
        if (groupsConfigured) {
          warnings.push(
            "channels.dingtalk: groupPolicy is 'open' but group allowlist is configured (will be ignored)",
          );
        }
      }

      return warnings;
    },
  },
  directory: {
    groups: () => [],
    peers: () => [],
  },
  outbound: {
    deliveryMode: "direct",
    chunker: null,
    textChunkLimit: 4000,
    sendText: async ({ cfg, to, text, accountId }) => {
      const account = resolveDingTalkAccount(cfg, accountId ?? DEFAULT_ACCOUNT_ID);
      const apiClient = getApiClient(account);

      if (!account.robotCode) {
        throw new Error("robotCode not configured, cannot send message");
      }

      await apiClient.sendSingleChatMessage({
        robotCode: account.robotCode,
        userId: to,
        content: text,
      });

      return { channel: "dingtalk", messageId: Date.now().toString() };
    },
    sendMedia: async ({ cfg, to, text, mediaUrl, accountId }) => {
      const account = resolveDingTalkAccount(cfg, accountId ?? DEFAULT_ACCOUNT_ID);
      const apiClient = getApiClient(account);
      const mergedText = mediaUrl ? `${text}\n${mediaUrl}` : text;

      if (!account.robotCode) {
        throw new Error("robotCode not configured, cannot send message");
      }

      await apiClient.sendSingleChatMessage({
        robotCode: account.robotCode,
        userId: to,
        content: mergedText,
      });

      return { channel: "dingtalk", messageId: Date.now().toString() };
    },
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      ctx.log?.info(`[${account.accountId}] starting DingTalk provider`);

      console.log(`[dingtalk channel] Starting Stream client for account ${account.accountId}`);
      await startStreamClient(account);

      return new Promise<void>((resolve) => {
        ctx.abortSignal.addEventListener("abort", () => {
          console.log(`[dingtalk channel] Stopping Stream client for account ${account.accountId}`);
          stopStreamClient(account);
          resolve();
        });
      });
    },
  },
};
