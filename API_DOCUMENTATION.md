# API & WebSocket Protocol Documentation

This document outlines the REST API routes, WebSocket events, and authentication details for the Real-Time Chat Application.

---

## 1. Authentication

The system uses JWT (JSON Web Token) authentication. Secured endpoints require the header:
`Authorization: Bearer <access_token>`

### Mock Login / Google OAuth Bypass
- **URL**: `/api/auth/google/`
- **Method**: `POST`
- **Payload**:
  ```json
  {
    "is_mock": true,
    "email": "user@example.com",
    "name": "Jane Doe",
    "avatar_url": "http://example.com/avatar.jpg"
  }
  ```
- **Response**:
  ```json
  {
    "access": "<access_token>",
    "refresh": "<refresh_token>",
    "user": {
      "id": 1,
      "username": "user_ae41",
      "email": "user@example.com",
      "first_name": "Jane",
      "last_name": "Doe",
      "avatar_url": "http://example.com/avatar.jpg"
    },
    "created": true
  }
  ```

### Refresh Token
- **URL**: `/api/auth/refresh/`
- **Method**: `POST`
- **Payload**:
  ```json
  { "refresh": "<refresh_token>" }
  ```

### Logout Devices
- **Logout Current**: `POST` to `/api/auth/logout/` with `refresh` payload.
- **Logout All (Global)**: `POST` to `/api/auth/logout/all/` (invalidates all devices by resetting password keys).

---

## 2. REST API Endpoints

### Contacts & Profiles
- `GET /api/profiles/self/` — Fetch current user's profile bio, avatar, and settings.
- `PUT /api/profiles/profile/` — Update bio details or upload a new profile picture.
- `GET /api/contacts/` — Fetch saved contacts list.
- `POST /api/contacts/` — Add contact by payload `{"contact_id": <user_id>}`.
- `DELETE /api/contacts/<id>/` — Delete a contact.
- `POST /api/contacts/<id>/toggle_favorite/` — Toggle favorited status.

### Chat Sessions & Messaging
- `GET /api/chats/` — Retrieve active direct messages and group chats list.
- `POST /api/chats/` — Start DM chat session:
  ```json
  { "type": "DM", "participants": [2] }
  ```
- `GET /api/chats/<chat_id>/messages/` — Retrieve conversation message history.
- `POST /api/chats/messages/<id>/react/` — Toggle emoji reaction on message (payload: `{"emoji": "👍"}`).
- `POST /api/chats/messages/<id>/star/` — Toggle starring message.
- `POST /api/chats/messages/<id>/pin/` — Toggle pinning message.
- `POST /api/chats/messages/<id>/delete_for_me/` — Deletes message for current user.
- `POST /api/chats/messages/<id>/delete_for_everyone/` — Redacts message content for all users in the chat.

### Groups Management
- `POST /api/groups/` — Create new group (Multipart/form-data: `name`, `description`, `profile_picture`, array of `members`).
- `GET /api/groups/<group_id>/` — Fetch group profile details.
- `POST /api/groups/<group_id>/add_members/` — Add users to group.
- `POST /api/groups/<group_id>/remove_member/` — Remove user from group.
- `POST /api/groups/<group_id>/promote_admin/` — Promote member to admin.
- `POST /api/groups/<group_id>/demote_admin/` — Demote admin to member.

### Status (Stories)
- `GET /api/status/` — Retrieve active 24-hour feeds of contacts.
- `POST /api/status/` — Create text or media story (Multipart/form-data).
- `GET /api/status/my_status/` — Retrieve stories posted by current user.
- `POST /api/status/<status_id>/view/` — Log view timestamp for a contact's story.

### Call Logs
- `GET /api/calls/` — Retrieve voice/video call history logs.
- `POST /api/calls/` — Add a call history log entry.

---

## 3. WebSockets Events

Connect via URL: `ws://localhost:8000/ws/chat/?token=<access_token>`

### Incoming WebSocket Actions (Client -> Server)

#### Send Message
```json
{
  "action": "send_message",
  "chat_id": 1,
  "content": "Hello world",
  "message_type": "TEXT",
  "media_url": null,
  "parent_message_id": null
}
```

#### Typing Status
```json
{
  "action": "typing",
  "chat_id": 1,
  "is_typing": true
}
```

#### Read Receipt
```json
{
  "action": "read_receipt",
  "chat_id": 1
}
```

#### WebRTC signaling Signal
```json
{
  "action": "call_signal",
  "receiver_id": 2,
  "signal": {
    "type": "offer",
    "sdp": "..."
  },
  "call_type": "VIDEO"
}
```

### Outbound WebSocket Broadcasts (Server -> Client)

#### Receive Message (`new_message`)
```json
{
  "type": "new_message",
  "chat_id": 1,
  "message": {
    "id": 105,
    "content": "Hello world",
    "sender": 1,
    "created_at": "2026-06-19T16:07:00Z"
  }
}
```

#### Typing Broadcast (`typing_status`)
```json
{
  "type": "typing_status",
  "chat_id": 1,
  "user_id": 1,
  "is_typing": true
}
```

#### Presence Broadcast (`presence_change`)
```json
{
  "type": "presence_change",
  "user_id": 1,
  "is_online": true,
  "last_seen": "2026-06-19T16:07:00Z"
}
```

#### Calling signaling Broadcast (`call_signal`)
```json
{
  "type": "call_signal",
  "sender_id": 1,
  "signal": { ... },
  "call_type": "VIDEO"
}
```
