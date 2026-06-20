import { useState, useRef, useEffect } from 'react';
import { HiArrowLeft, HiPaperAirplane, HiEmojiHappy } from 'react-icons/hi';
import { FiMic } from 'react-icons/fi';
import axios from 'axios';
import Message from './Message';
import EmojiPicker from './EmojiPicker';
import VoiceRecorder from './VoiceRecorder';

export default function ChatWindow({ selectedUser, messages, currentUser, socket, onlineUsers, show, onSend, onBack, onLoadOlder }) {
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!socket) return;
    const handleTyping = ({ userId }) => { if (userId === selectedUser?.id) setTyping(true); };
    const handleStopTyping = ({ userId }) => { if (userId === selectedUser?.id) setTyping(false); };
    const handleRead = ({ by, chatWith }) => {
      if (by === selectedUser?.id) setReadReceipts((prev) => ({ ...prev, [chatWith]: true }));
    };
    socket.on('typing', handleTyping);
    socket.on('stop-typing', handleStopTyping);
    socket.on('messages:read', handleRead);
    return () => {
      socket.off('typing', handleTyping);
      socket.off('stop-typing', handleStopTyping);
      socket.off('messages:read', handleRead);
    };
  }, [socket, selectedUser]);

  useEffect(() => {
    if (selectedUser && socket) {
      socket.emit('messages:mark-read', { fromUserId: selectedUser.id });
    }
  }, [selectedUser, messages, socket]);

  const handleSend = () => {
    if (!input.trim() && !replyTo) return;
    onSend(input.trim(), null, replyTo?.id || null);
    setInput('');
    setReplyTo(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert('File too large (max 15MB)');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post('/api/upload', formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      onSend(null, data.url, replyTo?.id || null);
      setReplyTo(null);
    } catch {
      alert('Upload failed');
    }
  };

  const handleScroll = async () => {
    const el = messagesRef.current;
    if (!el || loadingOlder) return;
    if (el.scrollTop < 80) {
      setLoadingOlder(true);
      const hasMore = await onLoadOlder?.();
      if (hasMore === false) setLoadingOlder(false);
      else setLoadingOlder(false);
    }
  };

  const handleTyping = () => {
    socket?.emit('typing', { receiverId: selectedUser.id });
    clearTimeout(window.typingTimer);
    window.typingTimer = setTimeout(() => {
      socket?.emit('stop-typing', { receiverId: selectedUser.id });
    }, 1000);
  };

  const handleVoiceSend = (content, audioUrl) => {
    onSend(null, null, audioUrl, replyTo?.id || null);
    setReplyTo(null);
    setShowVoice(false);
  };

  if (!selectedUser) {
    return (
      <div className={`${show ? 'flex' : 'hidden'} md:flex flex-1 flex-col items-center justify-center bg-[#222e35]`}>
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-[#2a3942] flex items-center justify-center mx-auto mb-4">
            <HiPaperAirplane className="text-[#8696a0] rotate-45" size={32} />
          </div>
          <h2 className="text-white text-xl font-medium">Chat App</h2>
          <p className="text-[#8696a0] mt-1">Select a conversation or search for a user</p>
        </div>
      </div>
    );
  }

  const isOnline = onlineUsers.has(selectedUser.id);

  return (
    <div className={`${show ? 'flex' : 'hidden'} md:flex flex-1 flex-col bg-[#222e35]`}>
      <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3 border-b border-[#313d45]">
        <button onClick={onBack} className="md:hidden text-white">
          <HiArrowLeft size={22} />
        </button>
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-[#2a3942] flex items-center justify-center text-white font-medium overflow-hidden">
            {selectedUser.avatar ? (
              <img src={selectedUser.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              selectedUser.displayName?.[0]?.toUpperCase() || '?'
            )}
          </div>
          {isOnline && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#00a884] rounded-full border-2 border-[#202c33]" />
          )}
        </div>
        <div>
          <div className="text-white font-medium">{selectedUser.displayName}</div>
          <div className="text-[#8696a0] text-xs">
            {typing ? (
              <span className="text-[#00a884]">typing...</span>
            ) : isOnline ? (
              'online'
            ) : (
              `@${selectedUser.username}`
            )}
          </div>
        </div>
      </div>

      <div
        ref={messagesRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1"
        style={{ backgroundImage: "url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" width=\"32\" height=\"32\"><rect width=\"32\" height=\"32\" fill=\"%23222e35\"/><circle cx=\"16\" cy=\"16\" r=\"1\" fill=\"%232a3942\" opacity=\"0.3\"/></svg>')" }}
      >
        {loadingOlder && (
          <div className="text-center py-2">
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-[#00a884] mx-auto" />
          </div>
        )}
        {messages.map((msg) => {
          const isMine = msg.senderId === currentUser.id;
          return (
            <Message
              key={msg.id}
              msg={msg}
              isMine={isMine}
              currentUser={currentUser}
              socket={socket}
              onReply={(m) => {
                setReplyTo(m);
                inputRef.current?.focus();
              }}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {replyTo && (
        <div className="bg-[#1a2733] px-4 py-2 flex items-center gap-2 border-t border-[#313d45]">
          <div className="flex-1 text-sm">
            <span className="text-[#00a884] font-medium">
              Replying to {replyTo.senderId === currentUser.id ? 'yourself' : selectedUser.displayName}
            </span>
            <div className="text-[#aebac1] truncate">
              {replyTo.imageUrl ? '📷 Photo' : replyTo.audioUrl ? '🎤 Voice' : replyTo.content}
            </div>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-[#8696a0] hover:text-white">
            ✕
          </button>
        </div>
      )}

      <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3">
        {!showVoice && (
          <>
            <div className="relative">
              <button
                onClick={() => { setShowEmoji(!showEmoji); setShowVoice(false); }}
                className="text-[#8696a0] hover:text-white transition"
              >
                <HiEmojiHappy size={24} />
              </button>
              {showEmoji && (
                <EmojiPicker
                  onSelect={(emoji) => { setInput((p) => p + emoji); inputRef.current?.focus(); }}
                  onClose={() => setShowEmoji(false)}
                />
              )}
            </div>
            <div className="flex-1 bg-[#2a3942] rounded-lg flex items-center">
              <input
                ref={inputRef}
                type="text"
                placeholder="Type a message"
                value={input}
                onChange={(e) => { setInput(e.target.value); handleTyping(); }}
                onKeyDown={handleKeyDown}
                className="bg-transparent text-white px-4 py-3 w-full placeholder-[#8696a0] text-[15px]"
              />
              <label className="cursor-pointer text-[#8696a0] hover:text-white transition px-2">
                📷
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            </div>
            {input.trim() ? (
              <button onClick={handleSend} className="text-[#8696a0] hover:text-white transition">
                <HiPaperAirplane size={22} className="rotate-45" />
              </button>
            ) : (
              <button
                onClick={() => { setShowVoice(true); setShowEmoji(false); }}
                className="text-[#8696a0] hover:text-white transition"
              >
                <FiMic size={22} />
              </button>
            )}
          </>
        )}
        {showVoice && (
          <VoiceRecorder onSend={handleVoiceSend} onClose={() => setShowVoice(false)} />
        )}
      </div>
    </div>
  );
}
