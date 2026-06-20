import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';

export default function Chat() {
  const [socket, setSocket] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [showMobileList, setShowMobileList] = useState(true);
  const { user, logout } = useAuth();
  const selectedUserRef = useRef(selectedUser);
  const currentUserRef = useRef(user);
  selectedUserRef.current = selectedUser;
  currentUserRef.current = user;

  useEffect(() => {
    const token = localStorage.getItem('token');
    const s = io('/', { auth: { token } });
    setSocket(s);

    s.on('message:new', (msg) => {
      setMessages((prev) => {
        if (prev.length > 0 && (prev[0].senderId === msg.senderId || prev[0].senderId === msg.receiverId)) {
          return [...prev, msg];
        }
        return prev;
      });
      loadConversations();
    });

    s.on('message:edit', (updated) => {
      setMessages((prev) => prev.map((m) => m.id === updated.id ? { ...m, content: updated.content, edited: updated.edited } : m));
      loadConversations();
    });

    s.on('message:delete', ({ id }) => {
      setMessages((prev) => prev.map((m) => m.id === id ? { ...m, deleted: 1, content: null, imageUrl: null, audioUrl: null } : m));
      loadConversations();
    });

    s.on('message:react', (updated) => {
      setMessages((prev) => prev.map((m) => m.id === updated.id ? { ...m, reactions: updated.reactions } : m));
    });

    s.on('messages:read', ({ by, chatWith }) => {
      if (by === selectedUserRef.current?.id) {
        setMessages((prev) => prev.map((m) => {
          if (m.senderId === currentUserRef.current?.id && m.receiverId === by) {
            return { ...m, read: 1 };
          }
          return m;
        }));
      }
      loadConversations();
    });

    s.on('user:online', ({ userId }) => setOnlineUsers((prev) => new Set(prev).add(userId)));
    s.on('user:offline', ({ userId }) => setOnlineUsers((prev) => { const next = new Set(prev); next.delete(userId); return next; }));

    return () => s.disconnect();
  }, []);

  const loadConversations = async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get('/api/conversations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConversations(data);
    } catch {}
  };

  useEffect(() => {
    loadConversations();
  }, []);

  const selectUser = (u) => {
    setSelectedUser(u);
    setShowMobileList(false);
    loadMessages(u.id);
  };

  const loadMessages = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(`/api/messages/${userId}?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(data);
    } catch {}
  };

  const loadOlderMessages = async (userId, beforeId) => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(`/api/messages/${userId}?before=${beforeId}&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.length > 0) {
        setMessages((prev) => [...data, ...prev]);
      }
      return data.length > 0;
    } catch { return false; }
  };

  const sendMessage = (content, imageUrl, audioUrl, repliedTo) => {
    if (!selectedUser || (!content && !imageUrl && !audioUrl)) return;
    socket?.emit('message:send', { receiverId: selectedUser.id, content, imageUrl, audioUrl, repliedTo });
    loadConversations();
  };

  return (
    <div className="h-screen flex bg-[#111b21]">
      <Sidebar
        conversations={conversations}
        selectedUser={selectedUser}
        onlineUsers={onlineUsers}
        currentUser={user}
        onSelectUser={selectUser}
        onLogout={logout}
        show={showMobileList}
        onToggle={() => setShowMobileList(true)}
      />
      <ChatWindow
        selectedUser={selectedUser}
        messages={messages}
        currentUser={user}
        socket={socket}
        onlineUsers={onlineUsers}
        show={!showMobileList}
        onSend={sendMessage}
        onBack={() => { setShowMobileList(true); setSelectedUser(null); }}
        onLoadOlder={() => {
          if (messages.length > 0) {
            loadOlderMessages(selectedUser.id, messages[0].id);
          }
        }}
      />
    </div>
  );
}
