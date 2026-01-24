import { useState } from 'react';
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
import { useAuth } from '../contexts/AuthContext';

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      // TODO: Implement profile update API call
      // await authService.updateProfile(formData);
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
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
    } catch (err) {
      setError('Failed to logout');
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
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        {success && (
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-600">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{success}</span>
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white font-bold text-xl">
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
                <span className="text-sm">Credits Remaining</span>
              </div>
              <p className="text-2xl font-bold">{user?.credits ?? 0}</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <User className="w-4 h-4" />
                <span className="text-sm">Member Since</span>
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
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 pl-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 pl-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="your@email.com"
                  disabled // Email typically can't be changed
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
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

        {/* Danger Zone */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 text-destructive">Account Actions</h3>
          
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="font-medium">Sign Out</p>
              <p className="text-sm text-muted-foreground">Sign out of your account on this device</p>
            </div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors font-medium"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold mb-2">Sign Out?</h3>
            <p className="text-muted-foreground mb-4">
              Are you sure you want to sign out of your account?
            </p>
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 border border-input rounded-md hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleLogout}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors"
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
