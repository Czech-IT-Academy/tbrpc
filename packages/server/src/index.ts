import { baseRouter, baseRouteCaller, type RouterOptions } from "tbrpc-base";
import { type WebSocketServer, WebSocket } from "ws";
import http from "http";

type Tail<T extends any[]> = T extends [any, ...infer R] ? R : never;

export type ServerRouteContext<ClientOptions extends RouterOptions> = {
  ws: WebSocket;
  client: ReturnType<typeof baseRouteCaller<ClientOptions>>;
  clients: Map<WebSocket, ReturnType<typeof baseRouteCaller<ClientOptions>>>;
};

export type ClientRouteCaller<ClientOptions extends RouterOptions> = ReturnType<
  typeof baseRouteCaller<ClientOptions>
>;

export type ServerRouterOptions<ClientOptions extends RouterOptions> = {
  routes: {
    [key: string]: (
      context: ServerRouteContext<ClientOptions>,
      ...args: any[]
    ) => any;
  };
  onClientConnect?: (
    ws: WebSocket,
    request: http.IncomingMessage,
    clientRouteCaller: ClientRouteCaller<ClientOptions>
  ) => void;
  onClientDisconnect?: (
    ws: WebSocket,
    clientRouteCaller: ClientRouteCaller<ClientOptions>
  ) => void;
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
  const clients = new Map<WebSocket, ClientRouteCaller<ClientOptions>>();

  wsServer.on("connection", (ws, request) => {
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
    options.onClientConnect?.(ws, request, clientRouteCaller);

    // Add new client to the clients map
    clients.set(ws, clientRouteCaller);

    // Handle client disconnection
    ws.on("close", () => {
      clients.delete(ws);
      options.onClientDisconnect?.(ws, clientRouteCaller);
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
