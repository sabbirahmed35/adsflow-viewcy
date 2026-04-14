import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../store/auth.store';
import { apiPatch, getErrorMessage } from '../lib/api';
import { PageHeader } from '../components/layout/PageHeader';
import { useToast } from '../components/ui/Toast';
import { Spinner } from '../components/ui';
import { User } from '@shared/types';

export function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit } = useForm({
    defaultValues: { name: user?.name ?? '' },
  });

  const onSubmit = async (data: { name: string }) => {
    setSaving(true);
    try {
      const updated = await apiPatch<User>('/auth/profile', data);
      setUser(updated);
      toast.success('Profile updated');
    } catch (e) {
      toast.error('Update failed', getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Settings" description="Manage your account" />
      <div className="p-6 max-w-lg space-y-6">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Profile</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <input {...register('name')} className="input" required />
            </div>
            <div>
              <label className="label">Email</label>
              <input value={user?.email ?? ''} className="input" disabled />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
            </div>
            <div>
              <label className="label">Role</label>
              <input value={user?.role ?? ''} className="input" disabled />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <Spinner className="w-4 h-4" /> : 'Save changes'}
            </button>
          </form>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Account info</h3>
          <p className="text-xs text-gray-400 mb-4">Read-only account details</p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-400">Member since</dt>
              <dd className="text-gray-700">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-400">Plan</dt>
              <dd className="text-gray-700">Pro</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
