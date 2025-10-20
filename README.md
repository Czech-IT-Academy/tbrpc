# tBRPC
`tbrpc` (Typescript <ins>Bidirectional</ins> Remote Procedure Call)

## Usage:
### Client implementation:
```ts
import {
  clientRouter,
  clientRouteCaller,
} from '@cita-services/tbrpc/client';

// Import route definitions from the server
import { type ApiClientOptions } from '../<ServerProject>';

// Create a websocket connection to the server
const ws = new WebSocket('ws://localhost:8080');

// Create the route caller on the websocket connection using the types from server
// this is used to call remote procedures on the server
const routeCaller = clientRouteCaller<ApiClientOptions>(ws);

// Define remote procedures the server can call on the client
const router = clientRouter(ws, {
  routes: {
    clientPing: (name: string) => {
      return `Pong from client: ${name}`;
    },
  },
});

// Export the clientOption of this router to be used on the server
// This may be a bit confusing but the server is the client of the overall client in this case
// because it is the server calling procedures on the client and waiting for output
export type IFrameClientOptions = typeof router.clientOptions;
```

### Server implementation:
```ts
import { createServerRouter } from "@cita-services/tbrpc/server";
import { WebSocketServer } from "ws";

// Import route definitions from the client
import { type IFrameClientOptions } from "../../../../seat-picker-iframe/src/modules/seatPicker/ws";

// Create a websocket server
const wss = new WebSocketServer({ port: 8080 });

// Create the router with server side routes
const router = createServerRouter<IFrameClientOptions>()(wss, {
  routes: {
    // Each route is provided with a context argument which has 
    serverPing: (context, name: string) => {
      return `Pong: ${name}`;
    },
  },
});

// Export the clientOptions of this router to be used on the client
export type ApiClientOptions = typeof router.clientOptions;
```