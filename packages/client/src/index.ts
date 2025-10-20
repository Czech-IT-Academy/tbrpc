import { baseRouter, baseRouteCaller, type RouterOptions } from "@tbrpc/base";

function websocketSend(socket: WebSocket, data: string) {
  if (socket.readyState !== WebSocket.OPEN) {
    console.warn("WebSocket is not yet open.");
    return;
  }
  socket.send(data);
}

// Function to subscribe to incoming messages
function websocketOnMessageSubscriber(
  socket: WebSocket,
  subscriber: (data: string) => void
) {
  socket.addEventListener("message", (event) => {
    subscriber(event.data);
  });
}

export function clientRouteCaller<Options extends RouterOptions>(
  socket: WebSocket
) {
  return baseRouteCaller<Options>(
    (data: string) => websocketSend(socket, data),
    (subscriber) => websocketOnMessageSubscriber(socket, subscriber)
  );
}

export function clientRouter<Options extends RouterOptions>(
  socket: WebSocket,
  options: Options
) {
  return baseRouter(
    options,
    (data: string) => websocketSend(socket, data),
    (subscriber) => websocketOnMessageSubscriber(socket, subscriber)
  );
}
