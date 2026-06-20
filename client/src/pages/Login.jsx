import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { HiArrowRight } from 'react-icons/hi';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('/api/login', { email, password });
      login(res.data.token, res.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
    setLoading(false);
  };

  const sendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await axios.post('/api/send-otp', { email });
      setStep('register');
    } catch {
      setError('Failed to send OTP');
    }
    setLoading(false);
  };

  const verifyOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const code = otp.join('');
      const res = await axios.post('/api/verify-otp', {
        email,
        code,
        username,
        displayName,
        password: signupPassword,
      });
      login(res.data.token, res.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP');
    }
    setLoading(false);
  };

  const handleOtpChange = (idx, val) => {
    if (val && !/^\d$/.test(val)) return;
    const newOtp = [...otp];
    newOtp[idx] = val;
    setOtp(newOtp);
    if (val && idx < 5) {
      const next = document.getElementById(`otp-${idx + 1}`);
      next?.focus();
    }
    if (!val && idx > 0) {
      const prev = document.getElementById(`otp-${idx - 1}`);
      prev?.focus();
    }
    if (newOtp.every((d) => d) && !loading) {
      verifyOtp();
    }
  };

  const resetSignup = () => {
    setStep('email');
    setOtp(['', '', '', '', '', '']);
    setUsername('');
    setDisplayName('');
    setSignupPassword('');
    setError('');
  };

  return (
    <div className="h-screen flex items-center justify-center bg-[#111b21]">
      <div className="bg-[#222e35] rounded-lg p-8 w-full max-w-md border border-[#313d45]">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white">Chat App</h1>
          <p className="text-[#8696a0] mt-1">
            {mode === 'login' ? 'Sign in with your password' : 'Create your account'}
          </p>
        </div>

        <div className="flex bg-[#2a3942] rounded-lg mb-6">
          <button
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
              mode === 'login' ? 'bg-[#00a884] text-white' : 'text-[#8696a0]'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode('signup'); resetSignup(); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
              mode === 'signup' ? 'bg-[#00a884] text-white' : 'text-[#8696a0]'
            }`}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#2a3942] text-white px-4 py-3 rounded-lg border border-[#313d45] placeholder-[#8696a0] mb-3"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#2a3942] text-white px-4 py-3 rounded-lg border border-[#313d45] placeholder-[#8696a0] mb-4"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00a884] text-white py-3 rounded-lg font-medium hover:bg-[#06cf9c] transition flex items-center justify-center gap-2"
            >
              {loading ? 'Signing in...' : 'Sign In'}
              <HiArrowRight />
            </button>
          </form>
        )}

        {mode === 'signup' && step === 'email' && (
          <form onSubmit={sendOtp}>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#2a3942] text-white px-4 py-3 rounded-lg border border-[#313d45] placeholder-[#8696a0]"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-[#00a884] text-white py-3 rounded-lg font-medium hover:bg-[#06cf9c] transition flex items-center justify-center gap-2"
            >
              {loading ? 'Sending...' : 'Send OTP'}
              <HiArrowRight />
            </button>
          </form>
        )}

        {mode === 'signup' && step === 'register' && (
          <div>
            <input
              type="text"
              placeholder="Choose a username (unique)"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              className="w-full bg-[#2a3942] text-white px-4 py-3 rounded-lg border border-[#313d45] placeholder-[#8696a0] mb-3"
              required
            />
            <input
              type="text"
              placeholder="Your display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-[#2a3942] text-white px-4 py-3 rounded-lg border border-[#313d45] placeholder-[#8696a0] mb-3"
              required
            />
            <input
              type="password"
              placeholder="Set a password"
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
              className="w-full bg-[#2a3942] text-white px-4 py-3 rounded-lg border border-[#313d45] placeholder-[#8696a0] mb-3"
              required
              minLength={6}
            />
            <p className="text-[#8696a0] text-sm mb-3">Enter the 6-digit OTP sent to {email}</p>
            <div className="flex gap-2 justify-center mb-4">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  id={`otp-${idx}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  className="w-12 h-12 bg-[#2a3942] text-white text-center text-xl rounded-lg border border-[#313d45] focus:border-[#00a884]"
                />
              ))}
            </div>
            <button
              onClick={verifyOtp}
              disabled={loading || otp.some((d) => !d) || !signupPassword}
              className="w-full bg-[#00a884] text-white py-3 rounded-lg font-medium hover:bg-[#06cf9c] transition disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
            <button
              onClick={resetSignup}
              className="w-full mt-2 text-[#00a884] text-sm hover:underline"
            >
              Change email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
