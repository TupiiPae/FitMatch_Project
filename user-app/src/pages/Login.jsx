import { api } from '../lib/api';
import { useState } from 'react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('role', data.user.role);
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={submit} className="bg-white p-6 rounded-xl shadow w-80 space-y-3">
        <h2 className="text-xl font-semibold">Đăng nhập</h2>
        <input className="border p-2 w-full" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input type="password" className="border p-2 w-full" placeholder="Mật khẩu" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="w-full p-2 rounded bg-black text-white">Vào</button>
      </form>
    </div>
  );
}
