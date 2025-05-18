// src/websocket-server.ts
const server = Bun.serve({
  port: 3055,
  fetch(req, server) {
    // HTTP 요청을 웹소켓으로 업그레이드합니다.
    const success = server.upgrade(req);
    if (success) {
      // Bun은 자동으로 응답을 처리합니다.
      return undefined;
    }
    return new Response("Upgrade failed :(", { status: 500 });
  },
  websocket: {
    open(ws) {
      console.log("WebSocket connection opened");
      ws.send("Welcome to the Echo WebSocket Server!");
    },
    message(ws, message) {
      console.log(`Received message: ${String(message)}`);
      // 에코 서버: 받은 메시지를 그대로 클라이언트에게 다시 보냅니다.
      ws.send(String(message)); // String으로 명시적 변환
    },
    close(ws, code, reason) {
      console.log(`WebSocket connection closed: ${code} - ${String(reason)}`);
    },
    // error 핸들러는 WebSocketHandler 타입에 직접 존재하지 않음.
    // 대신 Bun.serve의 top-level error 핸들러 사용
  },
  error(error) {
    console.error("Server error:", error);
    return new Response("Internal Server Error", { status: 500 });
  },
});

console.log(`WebSocket server listening on ws://localhost:${server.port}`);