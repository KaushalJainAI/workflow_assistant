import { useState, useEffect, useRef } from 'react';
import { usePersistedState } from '../hooks/usePersistedState';
import { useNavigate } from 'react-router-dom';
import { 
  Settings as SettingsIcon,
  User,
  Bell,
  // Shield,  // MVP: unused while the Security tab is hidden
  Palette,
  Code,
  ChevronRight,
  Moon,
  Sun,
  Monitor,
  BarChart3,
  CreditCard,
  Zap,
  Check,
  Rocket,
  LogOut
} from 'lucide-react';
import { cn } from '../lib/utils';
import InsightsDashboard from '../components/billing/InsightsDashboard';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../contexts/authState';
import { authService } from '../api/auth';
import Select from '../components/ui/Select';
import NotificationsTab from '../components/settings/NotificationsTab';
import { useAIModels } from '../hooks/useAIModels';
import {
  DEFAULT_EFFORT, EFFORT_LABELS, effortLevelsFor, nearestEffort,
} from '../hooks/useEffortSelection';
import { DEFAULT_PROVIDER, DEFAULT_MODEL } from '../hooks/useChatModelSelection';

type SettingsTab = 'general' | 'account' | 'notifications' | 'security' | 'appearance' | 'api' | 'insights' | 'billing';


/**
 * The settings form's shape. It was `any`, which meant a typo in a field name
 * — in the initial value, the `user` sync below, or a `name` attribute — was a
 * silent no-op rather than a compile error.
 */
interface SettingsForm {
  instance_name: string;
  timezone: string;
  language: string;
  display_name: string;
  bio: string;
  first_name: string;
  last_name: string;
  email: string;
  llm_provider: string;
  llm_model: string;
  llm_effort: string;
  default_temperature: number;
  default_max_tokens: number;
}

export default function Settings() {
  const [activeTab, setActiveTab] = usePersistedState<SettingsTab>('settings.tab', 'general');
  const { theme, setTheme, colorTheme, setColorTheme } = useTheme();
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { providers: catalogue } = useAIModels();
  
  // Form State
  const [formData, setFormData] = useState<SettingsForm>({
    instance_name: '',
    timezone: 'UTC',
    language: 'English',
    display_name: '',
    bio: '',
    first_name: '',
    last_name: '',
    email: '',
    llm_provider: DEFAULT_PROVIDER,
    llm_model: DEFAULT_MODEL,
    llm_effort: DEFAULT_EFFORT,
    default_temperature: 0.7,
    default_max_tokens: 2048,
  });

  // The model list is read from the catalogue rather than written out here.
  // It used to be eight hardcoded options, and two of them — `gemini-3.6-flash`
  // and `gemini-3.1-pro-preview` — had since been retired in
  // `populate_models.py`, so this page offered models the picker in chat no
  // longer showed and the runtime would refuse. A second copy of a list the
  // server already publishes is a copy that drifts.
  const activeProvider = catalogue.find((p) => p.slug === formData.llm_provider);
  const effortLevels = effortLevelsFor(
    catalogue, formData.llm_provider, formData.llm_model,
  );
  // What the saved level would actually run at on the chosen model, by the same
  // rule the server applies. Shown rather than the raw stored value so the page
  // never displays a rung this model does not serve.
  const effectiveEffort = effortLevels.length
    ? nearestEffort(formData.llm_effort, effortLevels)
    : '';

  useEffect(() => {
    if (user) {
      setFormData({
        instance_name: user.instance_name || 'AIAAS Instance',
        timezone: user.timezone || 'UTC',
        language: user.language || 'English',
        display_name: user.display_name || '',
        bio: user.bio || '',
        first_name: user.name?.split(' ')[0] || '',
        last_name: user.name?.split(' ').slice(1).join(' ') || '',
        email: user.email || '',
        llm_provider: user.llm_provider || DEFAULT_PROVIDER,
        llm_model: user.llm_model || DEFAULT_MODEL,
        // `??` not `||`: '' is a real choice here — the model's own default —
        // and `||` would silently promote it back to `medium` on every load.
        llm_effort: user.llm_effort ?? DEFAULT_EFFORT,
        default_temperature: user.default_temperature || 0.7,
        default_max_tokens: user.default_max_tokens || 2048,
      });
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'api') {
      loadApiKey();
    }
  }, [activeTab]);

  const loadApiKey = async () => {
    try {
      const data = await authService.getApiKey();
      setApiKey(data.key);
    } catch (error) {
      console.error('Failed to load API key:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Prepare data for backend
      const patchData = {
        ...formData,
        user: {
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
        },
        theme_preference: theme,
        accent_color: colorTheme,
      };

      await authService.updateProfile(patchData);
      await refreshUser();
      alert('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerateKey = async () => {
    if (!confirm('Are you sure? This will invalidate your old key.')) return;
    try {
      const data = await authService.regenerateApiKey();
      setApiKey(data.key);
    } catch (error) {
      console.error('Failed to regenerate API key:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Helper to get initials from name
  const getInitials = () => {
    if (user?.name) {
      const parts = user.name.split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return user.name.slice(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return '??';
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await authService.uploadAvatar(file);
      await refreshUser();
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      alert('Failed to upload avatar');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const tabs = [
    { id: 'general' as const, label: 'General', icon: SettingsIcon },
    { id: 'account' as const, label: 'Account', icon: User },
    { id: 'insights' as const, label: 'Insights', icon: BarChart3 },
    { id: 'billing' as const, label: 'Billing', icon: CreditCard },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    // MVP: Security is the only tab with no `case` in renderContent(), so it
    // fell through to the "coming soon" default. Hidden rather than built out.
    // The 'security' member stays on SettingsTab and the default branch stays
    // below, so a persisted `settings.tab` of 'security' still lands somewhere
    // instead of crashing.
    // { id: 'security' as const, label: 'Security', icon: Shield },
    { id: 'appearance' as const, label: 'Appearance', icon: Palette },
    { id: 'api' as const, label: 'API', icon: Code },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">General settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">Instance name</p>
                    <p className="text-sm text-muted-foreground">Personalize your platform title</p>
                  </div>
                  <input 
                    type="text" 
                    name="instance_name"
                    value={formData.instance_name}
                    onChange={handleInputChange}
                    className="px-3 py-2 border border-input rounded-lg bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200"
                  />
                </div>
                
                {/* Provider, model and effort — the same three choices the
                    chat composer and the agent builder offer, driven by the
                    same catalogue so none of them can drift from the others. */}
                <div className="p-4 bg-muted/50 rounded-lg border border-primary/10 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        Default AI provider
                        <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                      </p>
                      <p className="text-sm text-muted-foreground">Who serves your AI features</p>
                    </div>
                    <Select
                      value={formData.llm_provider}
                      onChange={(val) => {
                        // Changing provider invalidates the model, so both move
                        // together. Leaving the old id in place would save a
                        // pair the runtime cannot route.
                        const first = catalogue.find((p) => p.slug === val)?.models?.[0]?.value ?? '';
                        setFormData((prev) => ({ ...prev, llm_provider: val, llm_model: first }));
                      }}
                      options={catalogue.map((p) => ({ value: p.slug, label: p.name }))}
                      placeholder="Choose a provider"
                      className="w-[250px]"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">Default AI model</p>
                      <p className="text-sm text-muted-foreground">The primary model for AI features</p>
                    </div>
                    <Select
                      value={formData.llm_model}
                      onChange={(val) => handleSelectChange('llm_model', val)}
                      showSearch={(activeProvider?.models?.length ?? 0) > 8}
                      options={(activeProvider?.models ?? []).map((mo) => ({
                        value: mo.value,
                        label: mo.is_free ? `${mo.name} · free` : mo.name,
                        is_free: mo.is_free,
                      }))}
                      placeholder="Choose a model"
                      className="w-[250px]"
                    />
                  </div>

                  {/* Hidden entirely for a model with no effort control, rather
                      than shown disabled: nothing would be sent for it, and a
                      greyed knob reads as "off" instead of "absent". */}
                  {effortLevels.length > 0 && (
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium">Reasoning effort</p>
                        <p className="text-sm text-muted-foreground">
                          How hard it thinks before answering
                        </p>
                      </div>
                      <Select
                        value={effectiveEffort}
                        onChange={(val) => handleSelectChange('llm_effort', val)}
                        options={[
                          { value: '', label: EFFORT_LABELS[''] },
                          ...effortLevels.map((level) => ({
                            value: level,
                            label: EFFORT_LABELS[level] ?? level,
                          })),
                        ]}
                        className="w-[250px]"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">Timezone</p>
                    <p className="text-sm text-muted-foreground">Set your default timezone</p>
                  </div>
                  <Select
                    value={formData.timezone}
                    onChange={(val) => handleSelectChange('timezone', val)}
                    options={[
                      { value: 'UTC', label: 'UTC' },
                      { value: 'America/New_York', label: 'America/New_York' },
                      { value: 'Europe/London', label: 'Europe/London' },
                      { value: 'Asia/Tokyo', label: 'Asia/Tokyo' },
                      { value: 'Asia/Kolkata', label: 'Asia/Kolkata' },
                    ]}
                    className="w-[200px]"
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">Language</p>
                    <p className="text-sm text-muted-foreground">Choose your preferred language</p>
                  </div>
                  <Select
                    value={formData.language}
                    onChange={(val) => handleSelectChange('language', val)}
                    options={[
                      { value: 'English', label: 'English' },
                      { value: 'Spanish', label: 'Spanish' },
                      { value: 'German', label: 'German' },
                      { value: 'French', label: 'French' },
                    ]}
                    className="w-[200px]"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'account':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Account settings</h3>
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg mb-4">
                <div 
                  onClick={handleAvatarClick}
                  className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-xl font-bold text-primary ring-4 ring-primary/5 overflow-hidden cursor-pointer group relative"
                >
                  {user?.avatar ? (
                    <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    getInitials()
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <User className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <p className="font-medium">{user?.name || 'User'}</p>
                  <p className="text-sm text-muted-foreground">{user?.email || ''}</p>
                </div>
                <button 
                  onClick={handleAvatarClick}
                  className="ml-auto px-4 py-2 border border-border/60 rounded-lg hover:bg-muted transition-colors"
                >
                  Change Avatar
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">First name</label>
                    <input 
                      type="text" 
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-input rounded-lg bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Last name</label>
                    <input 
                      type="text" 
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-input rounded-lg bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email address</label>
                  <input 
                    type="email" 
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Bio</label>
                  <textarea 
                    name="bio"
                    value={formData.bio}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-200 resize-none"
                    placeholder="Tell us a bit about yourself..."
                  />
                </div>
              </div>

              <div className="mt-10 pt-6 border-t border-border/60">
                <h4 className="text-sm font-semibold mb-2">Session</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Log out of your account on this device.
                </p>
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all duration-200 rounded-lg font-medium border border-border/60"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Appearance</h3>
              <div className="space-y-4">
                <div>
                  <p className="font-medium mb-3">Theme</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'light' as const, label: 'Light', icon: Sun },
                      { id: 'dark' as const, label: 'Dark', icon: Moon },
                      { id: 'system' as const, label: 'System', icon: Monitor },
                    ].map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        onClick={() => setTheme(id)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                          theme === id 
                            ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10' 
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <Icon className="w-6 h-6" />
                        <span className="text-sm font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-medium mb-3 text-foreground/90">Accent palette</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'blue' as const, label: 'Communication blue', color: 'bg-primary' },
                      { id: 'magenta' as const, label: 'Agent violet', color: 'bg-agent' },
                    ].map(({ id, label, color }) => (
                      <button
                        key={id}
                        onClick={() => setColorTheme(id)}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-300 relative overflow-hidden group/palette ${
                          colorTheme === id 
                            ? 'border-primary bg-primary/5 shadow-md shadow-primary/5' 
                            : 'border-border hover:border-primary/40 hover:bg-muted/30'
                        }`}
                      >
                        <div className={cn("w-5 h-5 rounded-full ring-2 ring-primary/20", color)} />
                        <span className="text-sm font-semibold">{label}</span>
                        {colorTheme === id && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-primary-foreground" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'api':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">API settings</h3>
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">API key</p>
                    <button 
                      onClick={handleRegenerateKey}
                      className="text-sm text-primary hover:underline"
                    >
                      Regenerate
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-background/50 border border-input rounded-lg text-sm font-mono overflow-hidden text-ellipsis">
                      {apiKey || '••••••••••••••••••••••••••••••••'}
                    </code>
                    <button 
                      onClick={() => apiKey && copyToClipboard(apiKey)}
                      className="px-3 py-2 border border-border/60 rounded-lg hover:bg-muted text-sm whitespace-nowrap transition-colors"
                    >
                      {isCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Keep this key secret. It allows full access to your account.
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="font-medium mb-2">Webhook URL</p>
                  <code className="block p-2 bg-background/50 border border-input rounded-lg text-sm font-mono break-all">
                    {window.location.origin}/api/webhook/
                  </code>
                </div>
              </div>
            </div>
          </div>
        );

      case 'insights':
        return (
          <div className="space-y-6">
            <div className="mb-6">
              <h3 className="text-lg font-medium">Insights</h3>
              <p className="text-sm text-muted-foreground mt-1">Analyze your workflow performance and ROI</p>
            </div>
            <InsightsDashboard />
          </div>
        );

      case 'billing':
        return (
          <div className="space-y-8 max-w-7xl">
            <div>
              <h3 className="text-2xl font-bold tracking-tight">Billing & plans</h3>
              <p className="text-muted-foreground mt-1">Manage your subscription and usage limits</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="p-6 rounded-xl border border-border/60 bg-card/50">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-blue-500/12 rounded-xl">
                    <Zap className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Monthly executions</p>
                    <h3 className="text-2xl font-bold">{user?.credits || 0} / 50,000</h3>
                  </div>
                </div>
                <div className="mt-4 h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-[25%] rounded-full shadow-[0_0_8px_hsl(var(--primary)/0.2)]" />
                </div>
              </div>

              <div className="p-6 rounded-xl border border-border/60 bg-card/50">
                 <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-purple-500/12 rounded-xl">
                    <Rocket className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tier</p>
                    <h3 className="text-2xl font-bold capitalize">{user?.tier || 'Free'}</h3>
                  </div>
                </div>
                <div className="mt-4 h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-purple-600 w-[100%] rounded-full opacity-20" />
                </div>
              </div>

              <div className="p-6 rounded-xl border border-border/60 bg-card/50">
                 <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-emerald-500/12 rounded-xl">
                    <CreditCard className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Credits remaining</p>
                    <h3 className="text-2xl font-bold">{user?.credits || 0}</h3>
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-sm text-muted-foreground">Next refill: Next Month</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {[
                {
                  name: 'Starter',
                  price: '$0',
                  description: 'Perfect for testing and personal projects',
                  features: ['5 active workflows', '1,000 executions/month', 'Community support', 'Basic integrations', '7-day history']
                },
                {
                  name: 'Pro',
                  price: '$29',
                  period: '/month',
                  description: 'For professionals and growing teams',
                  features: ['Unlimited workflows', '50,000 executions/month', 'Priority email support', 'Advanced integrations', '30-day history', 'AI Generation'],
                  highlight: true
                },
                {
                  name: 'Enterprise',
                  price: 'Custom',
                  description: 'For large organizations with custom needs',
                  features: ['Unlimited executions', 'Dedicated manager', 'SSO & Advanced Security', 'Custom SLAs', 'Unlimited history', 'On-premise option']
                }
              ].map((plan) => (
                <div key={plan.name} className={cn(
                  "rounded-2xl border flex flex-col p-8 relative overflow-hidden transition-all duration-300 hover:shadow-lg bg-card/50",
                  plan.highlight ? "border-primary/50 shadow-xl shadow-primary/10 scale-105 z-10" : "border-border/60"
                )}>
                  {plan.highlight && (
                    <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl tracking-wider">
                      POPULAR
                    </div>
                  )}
                  <div className="mb-6">
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    <p className="text-muted-foreground text-sm mt-2">{plan.description}</p>
                  </div>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-emerald-500" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <button className={cn(
                    "w-full py-2.5 rounded-lg font-medium transition-all active:scale-[0.98]",
                    plan.highlight 
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm" 
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  )}>
                    {user?.tier?.toLowerCase() === plan.name.toLowerCase() ? 'Current Plan' : 'Upgrade'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );

      case 'notifications':
        return <NotificationsTab />;

      default:
        return (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <p>Settings for {activeTab} coming soon...</p>
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row">
      {/* Settings Sidebar */}
      <div className="w-full md:w-64 border-b md:border-r md:border-b-0 border-border/60 bg-card/80 backdrop-blur-xl p-2 md:p-4 shrink-0 overflow-x-auto scrollbar-none">
        <h2 className="text-lg font-semibold mb-2 md:mb-4 px-2 hidden md:block">Settings</h2>
        <nav className="flex flex-row md:flex-col space-x-2 md:space-x-0 md:space-y-1 min-w-max md:min-w-0 pb-1 md:pb-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 md:gap-3 px-3 py-2 md:py-2.5 rounded-lg transition-all duration-200 relative whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {activeTab === tab.id && (
                <div className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
              )}
              {activeTab === tab.id && (
                <div className="md:hidden absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-5 bg-primary rounded-t-full" />
              )}
              <tab.icon className="w-4 h-4 shrink-0" />
              <span className="md:flex-1 text-left text-sm md:text-base">{tab.label}</span>
              <ChevronRight className={`hidden md:block w-4 h-4 transition-transform ${
                activeTab === tab.id ? 'rotate-90' : ''
              }`} />
            </button>
          ))}
        </nav>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className={cn(
          "w-full",
          !['insights', 'billing'].includes(activeTab) && "max-w-3xl"
        )}>
          {renderContent()}
          
          {['general', 'account', 'appearance'].includes(activeTab) && (
            <div className="mt-8 pt-6 border-t border-border flex justify-end gap-2">
              <button className="px-4 py-2 border border-border/60 rounded-lg hover:bg-muted transition-colors">
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all duration-200 shadow-sm active:scale-[0.98] font-medium disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
