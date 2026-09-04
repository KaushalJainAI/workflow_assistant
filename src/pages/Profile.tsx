import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Mail, 
  Shield, 
  CreditCard, 
  LogOut, 
  Save, 
  Loader2,
  AlertCircle,
  Check,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '../contexts/authState';
import authService from '../api/auth';

export default function Profile() {
  const { user, logout, refreshUser, isLoading } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [passwordStep, setPasswordStep] = useState<'start' | 'otp' | 'reset'>('start');
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    otpCode: '',
    verificationToken: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);

  useEffect(() => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
    });
  }, [user?.name, user?.email]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      const [firstName, ...lastNameParts] = formData.name.trim().split(/\s+/);
      await authService.updateProfile({
        user: {
          first_name: firstName || '',
          last_name: lastNameParts.join(' '),
          email: formData.email.trim(),
        },
      });
      await refreshUser();
      setSuccess('Profile updated successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      setError('Failed to logout');
    }
  };

  const requestPasswordOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsPasswordSaving(true);
    try {
      const response = await authService.requestPasswordChangeOTP(passwordForm.oldPassword);
      setSuccess(response.detail);
      setPasswordStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const verifyPasswordOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsPasswordSaving(true);
    try {
      const response = await authService.verifyPasswordChangeOTP(passwordForm.otpCode);
      setPasswordForm({ ...passwordForm, verificationToken: response.verification_token });
      setSuccess(response.detail);
      setPasswordStep('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired OTP');
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const submitPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsPasswordSaving(true);
    try {
      const response = await authService.changePassword({
        old_password: passwordForm.oldPassword,
        verification_token: passwordForm.verificationToken,
        new_password: passwordForm.newPassword,
        confirm_password: passwordForm.confirmPassword,
      });
      setSuccess(response.detail);
      setPasswordStep('start');
      setPasswordForm({ oldPassword: '', otpCode: '', verificationToken: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'pro': return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
      case 'enterprise': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  const getTierLabel = (tier: string) => {
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Profile</h1>
            <p className="text-muted-foreground">Manage your account settings</p>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive animate-scale-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        {success && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2 text-emerald-400 animate-scale-in">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{success}</span>
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-card border border-border/60 rounded-xl p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl ring-4 ring-primary/5">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : user?.email?.slice(0, 2).toUpperCase() || '??'}
            </div>
            <div>
              <h2 className="text-xl font-semibold">{user?.name || 'User'}</h2>
              <p className="text-muted-foreground">{user?.email}</p>
              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border mt-1 ${getTierColor(user?.tier || 'free')}`}>
                <Shield className="w-3 h-3" />
                {getTierLabel(user?.tier || 'free')} Plan
              </div>
            </div>
          </div>

          {/* Account Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <CreditCard className="w-4 h-4" />
                <span className="text-sm">Credits remaining</span>
              </div>
              <p className="text-2xl font-bold">{user?.credits ?? 0}</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <User className="w-4 h-4" />
                <span className="text-sm">Member since</span>
              </div>
              <p className="text-2xl font-bold">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'N/A'}
              </p>
            </div>
          </div>

          {/* Edit Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="name">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 pl-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50 transition-all duration-200"
                  placeholder="Your name"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 pl-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50 transition-all duration-200"
                  placeholder="your@email.com"
                  disabled // Email typically can't be changed
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-lg text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 shadow-sm active:scale-[0.98]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </form>
        </div>

        <div className="bg-card border border-border/60 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Change password</h3>

          {passwordStep === 'start' && (
            <form onSubmit={requestPasswordOTP} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="old-password">Current password</label>
                <input
                  id="old-password"
                  type="password"
                  value={passwordForm.oldPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  required
                />
              </div>
              <button disabled={isPasswordSaving} className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground h-10 px-4 py-2 text-sm font-semibold disabled:opacity-50">
                {isPasswordSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send OTP
              </button>
            </form>
          )}

          {passwordStep === 'otp' && (
            <form onSubmit={verifyPasswordOTP} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="password-otp">Email OTP</label>
                <input
                  id="password-otp"
                  inputMode="numeric"
                  maxLength={6}
                  value={passwordForm.otpCode}
                  onChange={(e) => setPasswordForm({ ...passwordForm, otpCode: e.target.value.replace(/\D/g, '') })}
                  className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-center tracking-[0.4em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  required
                />
              </div>
              <button disabled={isPasswordSaving || passwordForm.otpCode.length !== 6} className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground h-10 px-4 py-2 text-sm font-semibold disabled:opacity-50">
                {isPasswordSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify OTP
              </button>
            </form>
          )}

          {passwordStep === 'reset' && (
            <form onSubmit={submitPasswordChange} className="space-y-4">
              <input type="password" placeholder="New password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50" required />
              <input type="password" placeholder="Confirm new password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} className="flex h-10 w-full rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50" required />
              <button disabled={isPasswordSaving} className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground h-10 px-4 py-2 text-sm font-semibold disabled:opacity-50">
                {isPasswordSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Password
              </button>
            </form>
          )}
        </div>

        {/* Danger Zone */}
        <div className="bg-card border border-border/60 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 text-destructive">Account actions</h3>
          
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="font-medium">Sign out</p>
              <p className="text-sm text-muted-foreground">Sign out of your account on this device</p>
            </div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors font-medium"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-card border border-border/60 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 animate-scale-in">
            <h3 className="text-lg font-semibold mb-2">Sign out?</h3>
            <p className="text-muted-foreground mb-4">
              Are you sure you want to sign out of your account?
            </p>
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 border border-border/60 rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleLogout}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
