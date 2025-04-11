// 파일 경로: handlers/notificationHandler.js

module.exports = function(io, socket) {

    // 사용자 개인 알림 채널 참여 이벤트 리스너
    // 기존 'join_room' 에서 이름 변경 ('join_user_channel')
    socket.on('join_user_channel', (userId) => {
        if (userId) {
            // 사용자 ID 기반의 고유한 룸 이름 사용 (예: 'user_123')
            const userRoomName = 'user_' + String(userId);
            console.log(`[NotificationHandler Socket ${socket.id}] Received 'join_user_channel'. Joining room: ${userRoomName}`);
            socket.join(userRoomName); // 해당 소켓을 user_roomId 방에 참여시킴
            // 필요 시 클라이언트에 성공 피드백 전송
            // socket.emit('joined_user_channel_success', userRoomName);
        } else {
            console.error(`[NotificationHandler Socket ${socket.id}] 'join_user_channel' event received without userId.`);
            // 필요 시 클라이언트에 실패 피드백 전송
            // socket.emit('joined_user_channel_failed', { reason: 'userId not provided' });
        }
    });

    // 여기에 다른 알림 관련 이벤트 리스너들을 추가할 수 있습니다.
    // 예: socket.on('mark_notification_read', (notificationId) => { ... });

    // 핸들러 등록 로그 (선택 사항)
    // console.log(`[NotificationHandler] Listeners registered for socket: ${socket.id}`);
};
