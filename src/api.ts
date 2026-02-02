import { request } from "undici";

export interface DingTalkApiConfig {
  clientId: string;
  clientSecret: string;
}

export interface DingTalkSendMessageOptions {
  conversationId?: string;
  userId?: string;
  robotCode?: string;
  msgKey?: string;
  msgParam?: string;
  content?: string;
}

export class DingTalkApiClient {
  private config: DingTalkApiConfig;
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(config: DingTalkApiConfig) {
    this.config = config;
  }

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiry) {
      return this.accessToken;
    }

    const url = `https://oapi.dingtalk.com/gettoken?appkey=${encodeURIComponent(
      this.config.clientId,
    )}&appsecret=${encodeURIComponent(this.config.clientSecret)}`;

    const response = await request(url, { method: "GET" });
    const data = (await response.body.json()) as {
      errcode: number;
      errmsg: string;
      access_token?: string;
      expires_in?: number;
    };

    if (data.errcode !== 0 || !data.access_token) {
      throw new Error(
        `Failed to get DingTalk access token: ${data.errmsg} (code: ${data.errcode})`,
      );
    }

    this.accessToken = data.access_token;
    this.tokenExpiry = now + (data.expires_in || 7200) * 1000 - 5 * 60 * 1000;

    return this.accessToken;
  }

  async sendMessageViaWebhook(params: {
    sessionWebhook: string;
    content: string;
    atUserIds?: string[];
    isAtAll?: boolean;
  }): Promise<void> {
    const { sessionWebhook, content, atUserIds, isAtAll } = params;

    const body = {
      msgtype: "text",
      text: {
        content,
      },
      at: {
        atUserIds: atUserIds || [],
        isAtAll: isAtAll || false,
      },
    };

    const accessToken = await this.getAccessToken();

    const response = await request(sessionWebhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-acs-dingtalk-access-token": accessToken,
      },
      body: JSON.stringify(body),
    });

    const data = (await response.body.json()) as {
      errcode?: number;
      errmsg?: string;
    };

    if (data.errcode && data.errcode !== 0) {
      throw new Error(
        `Failed to send DingTalk message via webhook: ${data.errmsg} (code: ${data.errcode})`,
      );
    }
  }

  async sendSingleChatMessage(params: {
    robotCode: string;
    userId: string;
    content: string;
  }): Promise<void> {
    const { robotCode, userId, content } = params;

    const accessToken = await this.getAccessToken();
    const url = "https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend";

    const body = {
      robotCode,
      userIds: [userId],
      msgKey: "sampleText",
      msgParam: JSON.stringify({ content }),
    };

    const response = await request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-acs-dingtalk-access-token": accessToken,
      },
      body: JSON.stringify(body),
    });

    const data = (await response.body.json()) as {
      errcode?: number;
      errmsg?: string;
    };

    if (data.errcode && data.errcode !== 0) {
      throw new Error(
        `Failed to send DingTalk single chat message: ${data.errmsg} (code: ${data.errcode})`,
      );
    }
  }

  async sendMarkdownViaWebhook(params: {
    sessionWebhook: string;
    title: string;
    text: string;
    atUserIds?: string[];
    isAtAll?: boolean;
  }): Promise<void> {
    const { sessionWebhook, title, text, atUserIds, isAtAll } = params;

    const body = {
      msgtype: "markdown",
      markdown: {
        title,
        text,
      },
      at: {
        atUserIds: atUserIds || [],
        isAtAll: isAtAll || false,
      },
    };

    const accessToken = await this.getAccessToken();

    const response = await request(sessionWebhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-acs-dingtalk-access-token": accessToken,
      },
      body: JSON.stringify(body),
    });

    const data = (await response.body.json()) as {
      errcode?: number;
      errmsg?: string;
    };

    if (data.errcode && data.errcode !== 0) {
      throw new Error(
        `Failed to send DingTalk markdown message: ${data.errmsg} (code: ${data.errcode})`,
      );
    }
  }
}
