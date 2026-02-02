import {
  DWClient,
  TOPIC_ROBOT,
  EventAck,
  type DWClientDownStream,
  type RobotMessage,
} from "dingtalk-stream";

export interface DingTalkStreamConfig {
  clientId: string;
  clientSecret: string;
  onMessage: (message: DingTalkIncomingMessage) => Promise<void>;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  debug?: boolean;
}

export interface DingTalkIncomingMessage {
  conversationId: string;
  conversationType: "1" | "2";
  senderId: string;
  senderStaffId: string;
  senderNick: string;
  senderCorpId: string;
  chatbotUserId: string;
  chatbotCorpId: string;
  msgId: string;
  msgtype: string;
  text?: {
    content: string;
  };
  atUsers?: Array<{
    dingtalkId: string;
    staffId?: string;
  }>;
  sessionWebhook: string;
  sessionWebhookExpiredTime: number;
  createAt: number;
  robotCode: string;
  isAdmin: boolean;
}

export class DingTalkStreamClient {
  private client: DWClient;
  private config: DingTalkStreamConfig;
  private isConnected = false;

  constructor(config: DingTalkStreamConfig) {
    this.config = config;

    this.client = new DWClient({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      debug: config.debug ?? false,
    });

    this.client.registerCallbackListener(TOPIC_ROBOT, async (res: DWClientDownStream) => {
      try {
        await this.handleRobotMessage(res);
      } catch (error) {
        console.error("[dingtalk stream-client] Error handling robot message:", error);
        if (this.config.onError) {
          this.config.onError(error as Error);
        }
      }
    });

    this.client.registerAllEventListener((message: DWClientDownStream) => {
      if (this.config.debug) {
        console.log("[dingtalk stream-client] Received event:", message);
      }
      return { status: EventAck.SUCCESS };
    });
  }

  private async handleRobotMessage(res: DWClientDownStream): Promise<void> {
    const robotMsg = JSON.parse(res.data) as RobotMessage;

    if (this.config.debug) {
      console.log("[dingtalk stream-client] Received robot message:", robotMsg);
    }

    const incomingMessage: DingTalkIncomingMessage = {
      conversationId: robotMsg.conversationId,
      conversationType: robotMsg.conversationType as "1" | "2",
      senderId: robotMsg.senderId,
      senderStaffId: robotMsg.senderStaffId,
      senderNick: robotMsg.senderNick,
      senderCorpId: robotMsg.senderCorpId,
      chatbotUserId: robotMsg.chatbotUserId,
      chatbotCorpId: robotMsg.chatbotCorpId,
      msgId: robotMsg.msgId,
      msgtype: robotMsg.msgtype,
      text: robotMsg.text,
      atUsers: robotMsg.atUsers,
      sessionWebhook: robotMsg.sessionWebhook,
      sessionWebhookExpiredTime: robotMsg.sessionWebhookExpiredTime,
      createAt: robotMsg.createAt,
      robotCode: robotMsg.robotCode,
      isAdmin: robotMsg.isAdmin,
    };

    await this.config.onMessage(incomingMessage);

    this.client.socketCallBackResponse(res.headers.messageId, {});
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      console.log("[dingtalk stream-client] Already connected");
      return;
    }

    try {
      console.log("[dingtalk stream-client] Connecting to DingTalk Stream...");
      await this.client.connect();
      this.isConnected = true;
      console.log("[dingtalk stream-client] Connected successfully");

      if (this.config.onConnected) {
        this.config.onConnected();
      }
    } catch (error) {
      console.error("[dingtalk stream-client] Connection failed:", error);
      this.isConnected = false;
      if (this.config.onError) {
        this.config.onError(error as Error);
      }
      throw error;
    }
  }

  disconnect(): void {
    if (!this.isConnected) {
      console.log("[dingtalk stream-client] Already disconnected");
      return;
    }

    console.log("[dingtalk stream-client] Disconnecting...");
    this.client.disconnect();
    this.isConnected = false;

    if (this.config.onDisconnected) {
      this.config.onDisconnected();
    }
  }

  isClientConnected(): boolean {
    return this.isConnected;
  }

  getClient(): DWClient {
    return this.client;
  }
}
