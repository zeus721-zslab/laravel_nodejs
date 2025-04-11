// 파일 경로: socketHandler.js (또는 socketSetup.js 등 - io 객체를 생성하고 설정하는 파일)

const { Server } = require("socket.io");
// 핸들러 모듈 불러오기
const chatHandler = require('./handlers/chatHandler');
const notificationHandler = require('./handlers/notificationHandler');

/**
 * Socket.IO 서버를 초기화하고 인증 미들웨어 및 이벤트 핸들러를 설정합니다.
 * @param {http.Server | https.Server} httpServer - Node.js HTTP 또는 HTTPS 서버 인스턴스
 * @returns {Server} 생성된 Socket.IO 서버 인스턴스
 */
function initializeSocket(io) {

    console.log('[SocketSetup] Registering authentication middleware...');

    if (io.opts.cors.origin) {
        console.log('[SocketSetup] Allowed CORS Origins:', io.opts.cors.origin);
    } else {
        console.warn('[SocketSetup] CORS origin is not explicitly set, might default to allow any origin (*).');
    }


    // === Socket.IO 인증 미들웨어 (Client Sends ID 방식) ===
    // 모든 소켓 연결 시도 시 'connection' 이벤트 핸들러보다 먼저 실행됩니다.
    io.use((socket, next) => {
        console.log(`[Auth Middleware] Middleware RUNNING for socket ${socket.id}. Handshake auth:`, socket.handshake.auth);
        // 클라이언트가 socket.io-client의 'auth' 옵션으로 보낸 userId를 읽습니다.
        const authenticatedUserId = socket.handshake.auth?.userId;
        console.log(`[Auth Middleware] Attempting authentication for socket ${socket.id}. Received auth data:`, socket.handshake.auth);

        if (!authenticatedUserId) {
            // userId가 auth 객체에 없으면 연결을 거부합니다.
            console.error(`[Auth Middleware] Authentication failed for socket ${socket.id}: No userId provided in handshake auth.`);
            // 오류 객체와 함께 next()를 호출하여 연결을 거부합니다.
            return next(new Error('Authentication error: No user ID provided.'));
        }

        // --- (보안 강화 - 선택 사항) ---
        // 실제 서비스에서는 여기서 Laravel API 엔드포인트를 호출하여
        // 전달받은 authenticatedUserId와 클라이언트의 쿠키(socket.request.headers.cookie)를 보내서
        // 해당 사용자가 유효한 세션을 가지고 있는지 서버 측에서 검증하는 로직을 추가하는 것이 좋습니다.
        // 지금 단계에서는 클라이언트가 보낸 ID를 신뢰하기로 합니다.
        // -----------------------------

        try {
            // userId를 파싱하여 숫자로 변환하고 소켓 요청 객체에 저장합니다.
            // 이후 모든 이벤트 핸들러에서 socket.request.userId 로 접근할 수 있습니다.
            socket.request.userId = parseInt(authenticatedUserId, 10);

            // userId가 유효한 숫자인지 확인합니다 (NaN 방지).
            if (isNaN(socket.request.userId)) {
                 console.error(`[Auth Middleware] Authentication failed for socket ${socket.id}: Invalid userId format.`);
                 return next(new Error('Authentication error: Invalid user ID format.'));
            }

            console.log(`[Auth Middleware] Socket ${socket.id} authenticated successfully as user ID: ${socket.request.userId}`);
            // 인증 성공 시 다음 미들웨어 또는 이벤트 핸들러로 진행합니다.
            next();

        } catch (error) {
             // 파싱 등 예기치 않은 오류 발생 시 처리
             console.error(`[Auth Middleware] Error during authentication processing for socket ${socket.id}:`, error);
             next(new Error('Authentication error: Internal server error during processing.'));
        }
    });
    console.log('[SocketSetup] Authentication middleware registered.');
    // === 미들웨어 끝 ===


    // === 클라이언트 연결 이벤트 리스너 ===
    // 인증 미들웨어를 성공적으로 통과한 소켓만 이 핸들러에 도달합니다.
    io.on('connection', (socket) => {
        // 연결 성공 및 인증된 사용자 ID 로그 출력
        console.log(`[SocketSetup] Client connected: ${socket.id}, Authenticated User ID: ${socket.request.userId}`);

        // 핸들러 모듈에 io 서버 인스턴스와 인증된 socket 객체를 전달하여
        // 각 모듈이 필요한 이벤트 리스너를 등록하도록 위임합니다.
        try {
            notificationHandler(io, socket); // 알림 관련 이벤트 처리 위임
            chatHandler(io, socket);       // 채팅 관련 이벤트 처리 위임
        } catch (handlerError) {
            // 핸들러 로딩 또는 실행 중 오류 발생 시 로깅 및 연결 종료
            console.error(`[SocketSetup] Error registering handlers for socket ${socket.id} (User ID: ${socket.request.userId}):`, handlerError);
            socket.disconnect(true); // 오류 발생 시 해당 소켓 연결 강제 종료
        }

        // 연결 해제 이벤트 처리
        socket.on('disconnect', (reason) => {
            console.log(`[SocketSetup] Client disconnected: ${socket.id}, User ID: ${socket.request.userId}, Reason: ${reason}`);
            // 필요 시 다른 핸들러에게 연결 해제 사실을 알립니다. (예: Presence 관리)
            // handleDisconnect(io, socket);
        });

        // 소켓 자체에서 발생하는 오류 처리 (연결이 수립된 후 발생하는 오류)
        socket.on('error', (err) => {
             console.error(`[SocketSetup] Socket error for ${socket.id} (User ID: ${socket.request.userId}):`, err.message);
        });

    });
    console.log('[SocketSetup] Connection event handler registered.');
    // === 연결 이벤트 리스너 끝 ===

    // 생성 및 설정된 Socket.IO 서버 인스턴스를 반환합니다.
    return io;
}

// initializeSocketServer 함수를 모듈로 내보냅니다.
module.exports = { initializeSocket };
