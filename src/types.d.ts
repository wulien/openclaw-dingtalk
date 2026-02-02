/// <reference types="node" />

declare module "dingtalk-stream" {
  import { EventEmitter } from "events";

  export enum EventAck {
    SUCCESS = "SUCCESS",
    LATER = "LATER",
  }

  export interface EventAckData {
    status: EventAck;
    message?: string;
  }

  export interface DWClientConfig {
    clientId: string;
    clientSecret: string;
    keepAlive?: boolean;
    debug?: boolean;
    ua?: string;
    endpoint?: string;
    access_token?: string;
    autoReconnect?: boolean;
    subscriptions: Array<{
      type: string;
      topic: string;
    }>;
  }

  export interface DWClientDownStream {
    specVersion: string;
    type: string;
    headers: {
      appId: string;
      connectionId: string;
      contentType: string;
      messageId: string;
      time: string;
      topic: string;
      eventType?: string;
      eventBornTime?: string;
      eventId?: string;
      eventCorpId?: string;
      eventUnifiedAppId?: string;
    };
    data: string;
  }

  export interface OnEventReceived {
    (msg: DWClientDownStream): EventAckData;
  }

  export interface RobotMessageBase {
    conversationId: string;
    chatbotCorpId: string;
    chatbotUserId: string;
    msgId: string;
    senderNick: string;
    isAdmin: boolean;
    senderStaffId: string;
    sessionWebhookExpiredTime: number;
    createAt: number;
    senderCorpId: string;
    conversationType: string;
    senderId: string;
    sessionWebhook: string;
    robotCode: string;
    msgtype: string;
    atUsers?: Array<{
      dingtalkId: string;
      staffId?: string;
    }>;
  }

  export interface RobotTextMessage extends RobotMessageBase {
    msgtype: "text";
    text: {
      content: string;
    };
  }

  export type RobotMessage = RobotTextMessage;

  export interface GraphAPIResponse {
    response: {
      statusLine: {
        code?: number;
        reasonPhrase?: string;
      };
      headers: {
        [key: string]: string;
      };
      body: string;
    };
  }

  export class DWClient extends EventEmitter {
    constructor(opts: {
      clientId: string;
      clientSecret: string;
      ua?: string;
      keepAlive?: boolean;
      debug?: boolean;
    });

    getConfig(): DWClientConfig;

    registerAllEventListener(onEventReceived: (v: DWClientDownStream) => EventAckData): this;

    registerCallbackListener(eventId: string, callback: (v: DWClientDownStream) => void): this;

    getAccessToken(): Promise<string>;

    connect(): Promise<void>;

    disconnect(): void;

    send(messageId: string, value: any): void;

    socketCallBackResponse(messageId: string, result: any): void;

    sendGraphAPIResponse(messageId: string, value: GraphAPIResponse): void;
  }

  export const TOPIC_ROBOT: string;
  export const TOPIC_CARD: string;
  export const TOPIC_AI_GRAPH_API: string;
  export const GET_TOKEN_URL: string;
  export const GATEWAY_URL: string;
}
