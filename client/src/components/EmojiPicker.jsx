import { useState, useRef, useEffect } from 'react';

const EMOJIS = [
  '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊',
  '😋', '😎', '😍', '🥰', '😘', '😗', '😙', '😚', '🙂', '🤗',
  '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥',
  '😮', '🤐', '😯', '😪', '😫', '😴', '😌', '😛', '😜', '😝',
  '🤤', '😒', '😓', '😔', '😕', '🙃', '🤑', '😲', '☹️', '😞',
  '😟', '😤', '😢', '😭', '😦', '😧', '😨', '😩', '🤯', '😬',
  '😰', '😱', '🥵', '🥶', '😳', '🤪', '😵', '😡', '😠', '🤬',
  '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲',
  '🤝', '🙏', '✌️', '🤟', '🤘', '👌', '❤️', '💔', '💯', '🔥',
  '💀', '⭐', '💪', '🎉', '🎊', '🥳', '✅', '❌', '💩', '👋',
];

export default function EmojiPicker({ onSelect, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose?.(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute bottom-14 left-0 bg-[#1f2c34] border border-[#313d45] rounded-lg p-2 shadow-xl z-50 w-[320px]">
      <div className="flex flex-wrap gap-1 max-h-[200px] overflow-y-auto">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            className="w-8 h-8 flex items-center justify-center hover:bg-[#2a3942] rounded text-lg transition"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
