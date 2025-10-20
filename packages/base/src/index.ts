import type { WSMessage } from "tbrpc-types";
import { uuid } from "./utils";

export type RouterOptions = {
  routes: {
    [key: string]: (...args: any[]) => any;
  };
};

function isLibMessage(message: any): message is WSMessage {
  return message && message.type === "tBRPC";
}

export function baseRouter<Options extends RouterOptions>(
  options: Options,
  websocketSend: (data: string) => void,
  websocketOnMessageSubscriber: (subscriber: (data: string) => void) => void
) {
  // Subscribe to incoming messages
  websocketOnMessageSubscriber(async (data: string) => {
    let message: WSMessage;

    try {
      const incomingMessage = JSON.parse(data);
      if (!isLibMessage(incomingMessage)) return;
      message = incomingMessage;
    } catch (error) {
      console.warn("Failed to parse ws message");
      return;
    }

    if (message.messageType === "request") {
      const { functionName, args, transactionId } = message;
      const routeFunction = options.routes[functionName];

      if (!routeFunction) {
        console.warn(`No route found for function: ${functionName}`);
      }

      const result = await routeFunction(...args);

      websocketSend(
        JSON.stringify({
          type: "tBRPC",
          messageType: "response",
          result,
          transactionId,
        } as WSMessage)
      );
    }
  });

  const router = {
    clientOptions: {
      routes: options.routes as Options["routes"],
    },
  };

  return router;
}

export function baseRouteCaller<ServerRouterOptions extends RouterOptions>(
  websocketSend: (data: string) => void,
  websocketOnMessageSubscriber: (subscriber: (data: string) => void) => void
) {
  // Map of transaction IDs to their resolve functions
  const transactions: Map<string, (value: any) => void> = new Map();

  // Subscribe to incoming messages
  websocketOnMessageSubscriber(async (data: string) => {
    let message: WSMessage;

    try {
      const incomingMessage = JSON.parse(data);
      if (!isLibMessage(incomingMessage)) return;
      message = incomingMessage;
    } catch (error) {
      console.warn("Failed to parse ws message");
      return;
    }

    if (message.messageType === "response") {
      const { transactionId, result } = message;
      const resolve = transactions.get(transactionId);
      if (resolve) {
        resolve(result);
        transactions.delete(transactionId);
      } else {
        console.warn(`No transaction found for ID: ${transactionId}`);
      }
    }
  });

  const callFunction = (functionName: string, ...args: any[]) => {
    const callTransactionId = uuid();

    const transactionPromise = new Promise<void>((resolve) => {
      transactions.set(callTransactionId, resolve);
    });

    websocketSend(
      JSON.stringify({
        type: "tBRPC",
        messageType: "request",
        functionName,
        args,
        transactionId: callTransactionId,
      } as WSMessage)
    );

    return transactionPromise;
  };

  const routes = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (typeof prop === "string") {
          return (...args: any[]) => callFunction(prop, ...args);
        }
        return undefined;
      },
    }
  );

  const caller = {
    routes: routes as ServerRouterOptions["routes"],
  };

  return caller;
}
