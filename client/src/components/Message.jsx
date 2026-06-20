import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import EmojiPicker from './EmojiPicker';

const EMOJI_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function Message({ msg, isMine, currentUser, socket, onReply }) {
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(msg.content || '');
  const [showReactions, setShowReactions] = useState(false);
  const [reactions, setReactions] = useState(msg.reactions ? JSON.parse(msg.reactions) : {});
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (msg.reactions) setReactions(JSON.parse(msg.reactions));
  }, [msg.reactions]);

  const handleEdit = async () => {
    if (!editText.trim() || editText === msg.content) { setEditing(false); return; }
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`/api/messages/${msg.id}`, { content: editText.trim() }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEditing(false);
    } catch {}
  };

  const handleDelete = async () => {
    if (!confirm('Delete this message?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/messages/${msg.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
    setShowMenu(false);
  };

  const handleReact = async (emoji) => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post(`/api/messages/${msg.id}/react`, { emoji }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReactions(data.reactions);
    } catch {}
    setShowReactionPicker(false);
  };

  useEffect(() => {
    if (!socket) return;
    const onEdit = (updated) => {
      if (updated.id === msg.id) {
        msg.content = updated.content;
        msg.edited = updated.edited;
        setEditText(updated.content || '');
      }
    };
    const onDelete = ({ id }) => {
      if (id === msg.id) msg.deleted = 1;
    };
    const onReact = (updated) => {
      if (updated.id === msg.id && updated.reactions) {
        setReactions(JSON.parse(updated.reactions));
      }
    };
    socket.on('message:edit', onEdit);
    socket.on('message:delete', onDelete);
    socket.on('message:react', onReact);
    return () => {
      socket.off('message:edit', onEdit);
      socket.off('message:delete', onDelete);
      socket.off('message:react', onReact);
    };
  }, [socket, msg.id]);

  if (msg.deleted) {
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} my-1`}>
        <div className={`px-3 py-2 rounded-lg italic text-[#8696a0] text-sm bg-[#1a2631]`}>
          This message was deleted
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} my-1 group`}>
      <div className="relative max-w-[75%]">
        <div
          className={`px-3 py-2 rounded-lg ${
            isMine
              ? 'bg-[#005c4b] text-white rounded-br-sm'
              : 'bg-[#202c33] text-white rounded-bl-sm'
          }`}
          onContextMenu={(e) => { e.preventDefault(); setShowMenu(true); }}
        >
          {msg.repliedTo && msg.repliedContent && (
            <div
              className={`text-xs mb-1.5 px-2 py-1 rounded border-l-2 cursor-pointer ${
                isMine ? 'border-[#87c4a0] bg-[#004d3d]' : 'border-[#00a884] bg-[#1a2b33]'
              }`}
              onClick={() => onReply?.(msg)}
            >
              <div className="font-medium text-[#00a884] text-[11px]">{msg.repliedSenderName === currentUser?.displayName ? 'You' : msg.repliedSenderName}</div>
              <div className="text-[#aebac1] truncate">{msg.repliedImage ? '📷 Photo' : msg.repliedContent}</div>
            </div>
          )}

          {msg.imageUrl && (
            <img
              src={msg.imageUrl}
              alt=""
              className="max-w-[250px] rounded-lg mb-1 cursor-pointer"
              onClick={() => window.open(msg.imageUrl, '_blank')}
            />
          )}

          {msg.audioUrl && (
            <audio src={msg.audioUrl} controls className="w-48 h-10 mb-1" />
          )}

          {msg.content && (
            <div className="text-[15px] whitespace-pre-wrap break-words">
              {msg.content}
            </div>
          )}

          {msg.edited ? <span className="text-[11px] text-[#aebac1]/60 ml-1">edited</span> : null}

          <div className="flex items-center justify-end gap-1 mt-1">
            <span className={`text-[11px] ${isMine ? 'text-[#aebac1]/70' : 'text-[#aebac1]/50'}`}>
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {isMine && (
              <span className="text-[11px]">
                {msg.read ? (
                  <span className="text-[#53bdeb]">✓✓</span>
                ) : (
                  <span className="text-[#aebac1]/50">✓</span>
                )}
              </span>
            )}
          </div>
        </div>

        {Object.keys(reactions).length > 0 && (
          <div className={`flex flex-wrap gap-1 -mt-2 mb-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(reactions).map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                className={`text-xs px-1.5 py-0.5 rounded-full border flex items-center gap-0.5 transition ${
                  users.includes(currentUser?.id)
                    ? 'bg-[#00a884]/20 border-[#00a884]/40'
                    : 'bg-[#1f2c34] border-[#313d45] hover:border-[#00a884]/40'
                }`}
              >
                <span>{emoji}</span>
                <span className="text-[#aebac1] text-[10px]">{users.length}</span>
              </button>
            ))}
          </div>
        )}

        {showMenu && (
          <div
            ref={menuRef}
            className={`absolute top-0 ${isMine ? 'right-0' : 'left-0'} bg-[#1f2c34] border border-[#313d45] rounded-lg shadow-xl z-50 py-1 min-w-[140px]`}
          >
            {isMine && (
              <button
                onClick={() => { setEditing(true); setShowMenu(false); }}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#2a3942] flex items-center gap-2"
              >
                ✏️ Edit
              </button>
            )}
            <button
              onClick={() => { onReply?.(msg); setShowMenu(false); }}
              className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#2a3942] flex items-center gap-2"
            >
              ↩️ Reply
            </button>
            <button
              onClick={() => { setShowReactionPicker(true); setShowMenu(false); }}
              className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#2a3942] flex items-center gap-2"
            >
              😊 React
            </button>
            {isMine && (
              <button
                onClick={handleDelete}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-[#2a3942] flex items-center gap-2"
              >
                🗑️ Delete
              </button>
            )}
          </div>
        )}

        {showReactionPicker && (
          <div className="absolute -bottom-10 left-0 bg-[#1f2c34] border border-[#313d45] rounded-lg p-1.5 flex gap-1 shadow-xl z-50">
            {EMOJI_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                className="w-7 h-7 flex items-center justify-center hover:bg-[#2a3942] rounded text-lg transition"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {editing && (
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleEdit(); if (e.key === 'Escape') setEditing(false); }}
              className="flex-1 bg-[#2a3942] text-white px-3 py-1.5 rounded-lg text-sm border border-[#313d45]"
              autoFocus
            />
            <button onClick={handleEdit} className="text-[#00a884] text-sm">Save</button>
            <button onClick={() => setEditing(false)} className="text-[#8696a0] text-sm">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
