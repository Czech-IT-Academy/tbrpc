import { baseRouter, baseRouteCaller, type RouterOptions } from "tbrpc-base";
import { type WebSocketServer, WebSocket } from "ws";

type Tail<T extends any[]> = T extends [any, ...infer R] ? R : never;

export type ServerRouterOptions<ClientOptions extends RouterOptions> = {
  routes: {
    [key: string]: (
      context: {
        ws: WebSocket;
        client: ReturnType<typeof baseRouteCaller<ClientOptions>>;
        clients: Map<
          WebSocket,
          ReturnType<typeof baseRouteCaller<ClientOptions>>
        >;
      },
      ...args: any[]
    ) => any;
  };
  onClientConnect?: (
    ws: WebSocket,
    clientRouteCaller: ReturnType<typeof baseRouteCaller<ClientOptions>>
  ) => void;
  onClientDisconnect?: (ws: WebSocket) => void;
};

export function createServerRouter<ClientOptions extends RouterOptions>() {
  return function serverRouter<
    Options extends ServerRouterOptions<ClientOptions>
  >(wsServer: WebSocketServer, options: Options) {
    return _serverRouter<ClientOptions, Options>(wsServer, options);
  };
}

function _serverRouter<
  ClientOptions extends RouterOptions,
  Options extends ServerRouterOptions<ClientOptions>
>(wsServer: WebSocketServer, options: Options) {
  const clients = new Map<
    WebSocket,
    ReturnType<typeof baseRouteCaller<Options>>
  >();

  wsServer.on("connection", (ws) => {
    // Create a client route caller for this connection
    const websocketSend = (data: string) => {
      if (ws.readyState !== WebSocket.OPEN) {
        console.warn("WebSocket is not yet open.");
        return;
      }
      ws.send(data);
    };
    const websocketOnMessageSubscriber = (
      subscriber: (data: string) => void
    ) => {
      ws.addEventListener("message", (event) => {
        subscriber(event.data.toString());
      });
    };

    const clientRouteCaller = baseRouteCaller<ClientOptions>(
      websocketSend,
      websocketOnMessageSubscriber
    );

    // Call the onClientConnect callback if provided
    options.onClientConnect?.(ws, clientRouteCaller);

    // Add new client to the clients map
    clients.set(ws, clientRouteCaller);

    // Handle client disconnection
    ws.on("close", () => {
      clients.delete(ws);
      options.onClientDisconnect?.(ws);
    });

    // Remap route handlers to strap the websocket as the first argument and provide this argument by creating a wrapper
    const remappedRoutes = Object.fromEntries(
      Object.entries(options.routes).map(([key, func]) => [
        key,
        (...args: Tail<Parameters<typeof func>>) =>
          func(
            {
              ws,
              client: clientRouteCaller,
              clients,
            },
            clientRouteCaller,
            ...args
          ),
      ])
    );

    const updatedOptions = { ...options, routes: remappedRoutes };

    // Create a router for this connection
    baseRouter(updatedOptions, websocketSend, websocketOnMessageSubscriber);
  });

  // Create a fake object to represent the actual routes the server provides
  // e.g this object only exists to provide type safety when accessing server routes
  // it should not ever be used as a value at runtime

  type ClientRoutes<Options extends ServerRouterOptions<ClientOptions>> = {
    [Key in keyof Options["routes"]]: (
      ...args: Tail<Parameters<Options["routes"][Key]>>
    ) => ReturnType<Options["routes"][Key]>;
  };

  return {
    clients,
    clientOptions: {
      routes: {} as ClientRoutes<Options>,
    },
  };
}
