// 파일 경로: handlers/chatHandler.js
// 채팅 관련 Socket.IO 이벤트 핸들러 모음

// 이 함수는 메인 소켓 설정 파일(예: socketHandler.js)에서
// connection 이벤트 발생 시 호출되며, io 서버 인스턴스와 개별 socket 객체를 인자로 받습니다.
module.exports = function(io, socket) {

    // 이 핸들러가 특정 소켓에 대해 등록될 때 로그 (디버깅용)
    console.log(`[ChatHandler] Registering chat event listeners for socket: ${socket.id}`);

    /**
     * 1. 채팅방 참여 ('join_chat_room') 이벤트 처리
     * 클라이언트(React)가 특정 채팅방 페이지에 들어왔을 때 발생시키는 이벤트
     */
    socket.on('join_chat_room', (roomId) => {
        // roomId 유효성 확인
        if (roomId) {
            // 실제 Socket.IO 룸 이름 생성 (예: 'chat_1')
            const chatRoomName = 'chat_' + String(roomId);

            // --- (선택 사항) 사용자의 방 참여 권한 확인 로직 ---
            // const canJoin = checkUserPermissionForRoom(socket.request.user?.id, roomId);
            // if (!canJoin) {
            //     console.error(`[ChatHandler Socket ${socket.id}] Unauthorized attempt to join room ${chatRoomName}`);
            //     socket.emit('join_chat_room_failed', { roomId: roomId, reason: 'Unauthorized' });
            //     return;
            // }
            // -------------------------------------------

            console.log(`[ChatHandler Socket ${socket.id}] Received 'join_chat_room' for roomId: ${roomId}. Joining room: ${chatRoomName}`);
            // 소켓을 해당 이름의 Socket.IO 룸에 참여시킴
            socket.join(chatRoomName);
            console.log(`[ChatHandler Socket ${socket.id}] Successfully joined room: ${chatRoomName}`);

            // (선택 사항) 참여 성공 피드백 또는 다른 참여자에게 알림
            // socket.emit('joined_chat_room_success', { roomId: roomId, roomName: chatRoomName });
            // socket.to(chatRoomName).emit('user_joined_chat', { userId: socket.request.user?.id, socketId: socket.id });

        } else {
            console.error(`[ChatHandler Socket ${socket.id}] Received 'join_chat_room' without valid roomId.`);
            // (선택 사항) 실패 피드백
            // socket.emit('join_chat_room_failed', { reason: 'Invalid roomId' });
        }
    });


    /**
     * 2. 채팅방 나가기 ('leave_chat_room') 이벤트 처리
     * 클라이언트(React)가 채팅방 페이지를 벗어날 때 발생시키는 이벤트
     */
    socket.on('leave_chat_room', (roomId) => {
        // roomId 유효성 확인
        if (roomId) {
            // 실제 Socket.IO 룸 이름 생성 (join 시 사용했던 이름과 동일하게)
            const chatRoomName = 'chat_' + String(roomId);

            console.log(`[ChatHandler Socket ${socket.id}] Received 'leave_chat_room' for roomId: ${roomId}. Leaving room: ${chatRoomName}`);
            // 소켓을 해당 이름의 Socket.IO 룸에서 나가게 함
            socket.leave(chatRoomName);
            console.log(`[ChatHandler Socket ${socket.id}] Successfully left room: ${chatRoomName}`);

            // --- (선택 사항) 다른 참여자에게 퇴장 알림 ---
            // const userId = socket.request.user?.id;
            // if (userId) {
            //     // socket.to(...) 는 자신을 제외한 룸의 다른 사람에게 보냄
            //     socket.to(chatRoomName).emit('user_left_chat', { userId: userId, socketId: socket.id });
            //     console.log(`[ChatHandler Socket ${socket.id}] Notified room ${chatRoomName} about user leaving.`);
            // }
            // -------------------------------------------

        } else {
            console.error(`[ChatHandler Socket ${socket.id}] Received 'leave_chat_room' without valid roomId.`);
        }
    });


    /**
     * 3. 메시지 전송 ('send_message') 이벤트 처리
     * 클라이언트(React)가 메시지를 DB에 저장 성공 후, 저장된 메시지 데이터를 포함하여 발생시키는 이벤트
     */
    socket.on('send_message', (messageData) => {
        // messageData는 클라이언트가 API 응답으로 받은 완전한 객체여야 함
        // 예: { id: 19, room_id: 1, user_id: 1, content: '...', created_at: '...', user: { id: 1, name: '...' } }
        console.log(`[ChatHandler Socket ${socket.id}] Received 'send_message' event with FULL message data:`, messageData);

        // 데이터 유효성 검사 (Laravel 모델 기준 키 이름: room_id, content)
        if (messageData && messageData.room_id && messageData.id && messageData.content) {

            // 브로드캐스팅 대상 방 이름 생성 (Laravel 모델 기준 키 이름: room_id)
            const chatRoomName = 'chat_' + String(messageData.room_id);

            // DB 저장 및 데이터 재구성은 이미 클라이언트/Laravel에서 완료됨

            // 해당 채팅방의 모든 참여자에게 'newMessage' 이벤트로 받은 messageData를 그대로 전달
            // io.to(roomName) 은 보낸 사람 포함 방의 모든 사람에게 전달
            io.to(chatRoomName).emit('newMessage', messageData);
            console.log(`[ChatHandler Socket ${socket.id}] Broadcasted 'newMessage' with full data to room ${chatRoomName}`);

        } else {
            // 필요한 데이터가 누락된 경우 오류 로그
            console.error(`[ChatHandler Socket ${socket.id}] Received 'send_message' with invalid or incomplete data (Check keys: room_id, id, content):`, messageData);
        }
    });


    /**
     * 4. 기타 채팅 관련 이벤트 리스너 (향후 확장 영역)
     */
    // === 4. 타이핑 시작 이벤트 리스너 ===
    socket.on('typing_start', (data) => {
        // data 객체에 roomId가 있는지 확인
        if (data && data.roomId) {
            const roomId = data.roomId;
            const chatRoomName = 'chat_' + String(roomId);

            // 이벤트 발생시킨 사용자 정보 가져오기 (인증 미들웨어 연동 가정)
//            const userId = socket.request.user.id;
//            const userName = socket.request.user.name || 'Someone'; // 이름 없으면 기본값
            const userId = socket.request.userId; // .user.id 대신 .userId 사용
            const userName = userId ? `User_${userId}` : 'Someone'; // 이름은 임시 처리 또는 다른 방법 강구


            if (userId) { // 사용자 ID가 있을 때만 브로드캐스트
                console.log(`[ChatHandler Socket ${socket.id}] Received 'typing_start' in room ${roomId}. Broadcasting 'user_typing' to ${chatRoomName}`);
                // 'socket.to(room)'는 자신을 제외한 방의 모든 사람에게 보냄
                socket.to(chatRoomName).emit('user_typing', {
                    userId: userId,
                    userName: userName,
                    roomId: roomId // 클라이언트에서 추가 확인용
                });
            } else {
                 console.warn(`[ChatHandler Socket ${socket.id}] Received 'typing_start' but user info not found.`);
            }
        } else {
            console.error(`[ChatHandler Socket ${socket.id}] Received 'typing_start' without valid roomId.`);
        }
    });
    // ==================================


    // === 5. 타이핑 종료 이벤트 리스너 ===
    socket.on('typing_stop', (data) => {
         // data 객체에 roomId가 있는지 확인
         if (data && data.roomId) {
            const roomId = data.roomId;
            const chatRoomName = 'chat_' + String(roomId);

            // 이벤트 발생시킨 사용자 ID 가져오기
//            const userId = socket.request.user.id;
            const userId = socket.request.userId; // .user.id 대신 .userId 사용


            if (userId) { // 사용자 ID가 있을 때만 브로드캐스트
                console.log(`[ChatHandler Socket ${socket.id}] Received 'typing_stop' in room ${roomId}. Broadcasting 'user_stopped_typing' to ${chatRoomName}`);
                // 자신을 제외한 방의 모든 사람에게 보냄
                socket.to(chatRoomName).emit('user_stopped_typing', {
                    userId: userId,
                    roomId: roomId // 클라이언트에서 추가 확인용
                });
            } else {
                console.warn(`[ChatHandler Socket ${socket.id}] Received 'typing_stop' but user info not found.`);
            }
        } else {
            console.error(`[ChatHandler Socket ${socket.id}] Received 'typing_stop' without valid roomId.`);
        }
    });
    // ==================================

}; // End of module exports function
