export type WSResponseMessage = {
  type: "tBRPC";
  messageType: "response";
  result: any;
  transactionId: string;
};

export type WSRequestMessage = {
  type: "tBRPC";
  messageType: "request";
  functionName: string;
  args: any[];
  transactionId: string;
};

export type WSMessage = WSRequestMessage | WSResponseMessage;
