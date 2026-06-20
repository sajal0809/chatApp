import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { FiSearch, FiLogOut, FiMessageCircle, FiCamera } from 'react-icons/fi';

export default function Sidebar({ conversations, selectedUser, onlineUsers, currentUser, onSelectUser, onLogout, show, onToggle }) {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState(currentUser?.avatar || null);
  const fileInputRef = useRef(null);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post('/api/upload-avatar', formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      setAvatarSrc(data.url);
    } catch {}
  };

  useEffect(() => { setAvatarSrc(currentUser?.avatar || null); }, [currentUser?.avatar]);

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token');
        const { data } = await axios.get(`/api/users/search?q=${search}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSearchResults(data);
        setSearching(true);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const allUsers = searching ? searchResults : conversations;
  const isEmpty = allUsers.length === 0 && !searching;

  return (
    <div className={`${show ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[420px] bg-[#111b21] border-r border-[#313d45] flex-shrink-0`}>
      <div className="bg-[#202c33] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white font-bold overflow-hidden">
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
              ) : (
                currentUser?.displayName?.[0]?.toUpperCase() || '?'
              )}
            </div>
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <FiCamera size={16} className="text-white" />
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <div>
            <div className="text-white font-medium">{currentUser?.displayName}</div>
            <div className="text-[#8696a0] text-xs">@{currentUser?.username}</div>
          </div>
        </div>
        <button onClick={onLogout} className="text-[#8696a0] hover:text-white transition">
          <FiLogOut size={20} />
        </button>
      </div>

      <div className="bg-[#111b21] px-3 py-2">
        <div className="flex items-center bg-[#202c33] rounded-lg px-3 py-2 gap-3">
          <FiSearch className="text-[#8696a0]" size={18} />
          <input
            type="text"
            placeholder="Search by username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-white placeholder-[#8696a0] w-full text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-[#8696a0] p-6 text-center">
            <FiMessageCircle size={48} className="mb-3 opacity-50" />
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs mt-1">Search for a user by username to start chatting</p>
          </div>
        )}
        {allUsers.map((u) => {
          const isOnline = onlineUsers.has(u.id);
          const isSelected = selectedUser?.id === u.id;
          const lastMsg = u.lastMessage || u.lastImage;
          return (
            <div
              key={u.id}
              onClick={() => {
                onSelectUser(u);
                setSearch('');
                setSearchResults([]);
                setSearching(false);
              }}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-[#313d45]/50 hover:bg-[#202c33] transition ${
                isSelected ? 'bg-[#2a3942]' : ''
              }`}
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-[#2a3942] flex items-center justify-center text-white font-medium overflow-hidden">
                  {u.avatar ? (
                    <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    u.displayName?.[0]?.toUpperCase() || '?'
                  )}
                </div>
                {isOnline && (
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#00a884] rounded-full border-2 border-[#111b21]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <span className="text-white font-medium truncate">{u.displayName}</span>
                  {u.lastTime && (
                    <span className="text-[#8696a0] text-xs flex-shrink-0">
                      {new Date(u.lastTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#8696a0] text-sm truncate">
                    @{u.username}
                  </span>
                  {u.lastDeleted ? (
                    <span className="text-[#8696a0] text-sm italic">Deleted message</span>
                  ) : u.lastImage ? (
                    <span className="text-[#8696a0] text-sm">📷 Photo</span>
                  ) : u.lastAudio ? (
                    <span className="text-[#8696a0] text-sm">🎤 Voice</span>
                  ) : u.lastMessage ? (
                    <span className="text-[#8696a0] text-sm truncate">{u.lastMessage}</span>
                  ) : null}
                </div>
              </div>
              {u.unread > 0 && (
                <div className="bg-[#00a884] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                  {u.unread}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
