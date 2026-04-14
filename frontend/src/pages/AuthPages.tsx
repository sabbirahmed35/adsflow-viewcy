import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../store/auth.store';
import { getErrorMessage } from '../lib/api';
import { Zap } from 'lucide-react';
import { Spinner } from '../components/ui';

function AuthShell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-semibold text-gray-900">AdFlow</span>
        </div>
        <div className="card p-8">
          <h1 className="text-lg font-semibold text-gray-900 mb-1">{title}</h1>
          <p className="text-sm text-gray-500 mb-6">{sub}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const { register, handleSubmit } = useForm<{ email: string; password: string }>();

  const onSubmit = async (data: { email: string; password: string }) => {
    setError('');
    try {
      await login(data.email, data.password);
      navigate('/');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <AuthShell title="Welcome back" sub="Sign in to your AdFlow account">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input {...register('email')} type="email" className="input" placeholder="you@company.com" required />
        </div>
        <div>
          <label className="label">Password</label>
          <input {...register('password')} type="password" className="input" placeholder="••••••••" required />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" className="btn btn-primary w-full justify-center" disabled={isLoading}>
          {isLoading ? <Spinner className="w-4 h-4" /> : 'Sign in'}
        </button>
      </form>
      <p className="text-center text-sm text-gray-500 mt-4">
        No account?{' '}
        <Link to="/register" className="text-indigo-600 font-medium hover:underline">Sign up</Link>
      </p>
      <div className="mt-6 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center mb-2">Demo credentials</p>
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex justify-between bg-gray-50 px-2 py-1 rounded">
            <span>Admin</span><span className="font-mono">admin@adflow.io / admin123</span>
          </div>
          <div className="flex justify-between bg-gray-50 px-2 py-1 rounded">
            <span>Client</span><span className="font-mono">jane@techlaunch.io / client123</span>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { register: registerUser, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const { register, handleSubmit } = useForm<{ name: string; email: string; password: string }>();

  const onSubmit = async (data: { name: string; email: string; password: string }) => {
    setError('');
    try {
      await registerUser(data.name, data.email, data.password);
      navigate('/');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <AuthShell title="Create account" sub="Start automating your Meta ad campaigns">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Full name</label>
          <input {...register('name')} className="input" placeholder="Jane Cooper" required />
        </div>
        <div>
          <label className="label">Work email</label>
          <input {...register('email')} type="email" className="input" placeholder="jane@company.com" required />
        </div>
        <div>
          <label className="label">Password</label>
          <input {...register('password')} type="password" className="input" placeholder="Min. 8 characters" required minLength={8} />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" className="btn btn-primary w-full justify-center" disabled={isLoading}>
          {isLoading ? <Spinner className="w-4 h-4" /> : 'Create account'}
        </button>
      </form>
      <p className="text-center text-sm text-gray-500 mt-4">
        Already have an account?{' '}
        <Link to="/login" className="text-indigo-600 font-medium hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}
