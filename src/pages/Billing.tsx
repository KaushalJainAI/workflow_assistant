import { Check, CreditCard, Zap, Shield, Rocket } from 'lucide-react';

export default function Billing() {
  const plans = [
    {
      name: 'Starter',
      price: '$0',
      description: 'Perfect for testing and personal projects',
      features: [
        '5 active workflows',
        '1,000 executions/month',
        'Community support',
        'Basic integrations',
        '7-day execution history'
      ],
      current: true,
      color: 'border-border/60'
    },
    {
      name: 'Pro',
      price: '$29',
      period: '/month',
      description: 'For professionals and growing teams',
      features: [
        'Unlimited active workflows',
        '50,000 executions/month',
        'Priority email support',
        'Advanced integrations',
        '30-day execution history',
        'AI Workflow Generation'
      ],
      highlight: true,
      color: 'bg-primary text-primary-foreground'
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      description: 'For large organizations with custom needs',
      features: [
        'Unlimited executions',
        'Dedicated success manager',
        'SSO & Advanced Security',
        'Custom SLAs',
        'Unlimited history',
        'On-premise deployment option'
      ],
      color: 'border-border/60'
    }
  ];

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Billing & Plans</h1>
        <p className="text-muted-foreground mt-2">Manage your subscription and usage limits</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="p-6 rounded-xl border border-border/60 bg-card">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-blue-500/12 rounded-xl">
              <Zap className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Monthly Executions</p>
              <h3 className="text-2xl font-bold">12,842 / 50,000</h3>
            </div>
          </div>
          <div className="mt-4 h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary w-[25%] rounded-full shadow-[0_0_8px_hsl(var(--primary)/0.2)]" />
          </div>
        </div>

        <div className="p-6 rounded-xl border border-border/60 bg-card">
           <div className="flex items-center gap-4">
            <div className="p-2.5 bg-purple-500/12 rounded-xl">
              <Rocket className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Workflows</p>
              <h3 className="text-2xl font-bold">18 / ∞</h3>
            </div>
          </div>
          <div className="mt-4 h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-purple-600 w-[100%] rounded-full opacity-20" />
          </div>
        </div>

        <div className="p-6 rounded-xl border border-border/60 bg-card">
           <div className="flex items-center gap-4">
            <div className="p-2.5 bg-emerald-500/12 rounded-xl">
              <CreditCard className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Current Plan</p>
              <h3 className="text-2xl font-bold">Pro</h3>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-muted-foreground">Next billing date: Feb 20, 2026</span>
          </div>
        </div>
      </div>


      <h2 className="text-xl font-semibold mb-6">Available Plans</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl stagger-children">
        {plans.map((plan) => (
          <div 
            key={plan.name}
            className={`rounded-2xl border ${plan.highlight ? 'border-primary/50 shadow-xl shadow-primary/10 scale-105' : `${plan.color}`} flex flex-col p-8 relative overflow-hidden transition-all duration-300 hover:shadow-lg bg-card`}
          >
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
                <li key={i} className="flex items-center gap-3 text-sm">
                  <div className={`rounded-full p-1 ${plan.highlight ? 'bg-primary/20 text-primary' : 'bg-emerald-500/12 text-emerald-400'}`}>
                    <Check className="w-3 h-3" />
                  </div>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            
            <button 
              className={`w-full py-2.5 rounded-lg font-medium transition-colors ${
                plan.highlight 
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm' 
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              } active:scale-[0.98]`}
            >
              {plan.current ? 'Current Plan' : 'Upgrade'}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-16 p-8 bg-muted/30 rounded-2xl border border-border/60">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-400" />
              Enterprise Security
            </h3>
            <p className="text-muted-foreground max-w-2xl">
              Need advanced security features, audit logs, and dedicated support? 
              Contact our sales team for a custom enterprise package tailored to your organization's needs.
            </p>
          </div>
          <button className="whitespace-nowrap px-6 py-2.5 bg-background border border-border/60 rounded-lg hover:bg-accent hover:text-accent-foreground font-medium transition-colors">
            Contact Sales
          </button>
        </div>
      </div>
    </div>
  );
}
