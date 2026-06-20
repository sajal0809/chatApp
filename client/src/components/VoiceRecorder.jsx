import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { FiMic, FiSquare, FiTrash2, FiSend } from 'react-icons/fi';

export default function VoiceRecorder({ onSend, onClose }) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorder = useRef(null);
  const chunks = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => { stopRecording(); clearInterval(timerRef.current); };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorder.current = recorder;
      chunks.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start(100);
      setRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => { if (d >= 30) { stopRecording(); return d; } return d + 1; });
      }, 1000);
    } catch {
      alert('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }
    setRecording(false);
    clearInterval(timerRef.current);
  };

  const cancelRecording = () => {
    stopRecording();
    setAudioBlob(null);
    setAudioUrl(null);
    onClose?.();
  };

  const sendRecording = async () => {
    if (!audioBlob) return;
    const formData = new FormData();
    formData.append('file', audioBlob, 'voice.webm');
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post('/api/upload', formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      onSend(null, data.url);
      onClose?.();
    } catch {
      alert('Upload failed');
    }
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 bg-[#202c33] px-4 py-3 rounded-lg">
      {!recording && !audioUrl && (
        <button onClick={startRecording} className="text-[#00a884] hover:text-white transition">
          <FiMic size={22} />
        </button>
      )}
      {recording && (
        <>
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white text-sm">{formatTime(duration)}</span>
          <button onClick={stopRecording} className="text-red-400 hover:text-red-300 ml-auto">
            <FiSquare size={18} />
          </button>
        </>
      )}
      {audioUrl && !recording && (
        <>
          <audio src={audioUrl} controls className="h-10 w-48" />
          <button onClick={sendRecording} className="text-[#00a884] hover:text-white">
            <FiSend size={20} />
          </button>
          <button onClick={cancelRecording} className="text-[#8696a0] hover:text-white">
            <FiTrash2 size={18} />
          </button>
        </>
      )}
    </div>
  );
}
