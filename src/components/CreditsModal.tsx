import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';

const STRIPE_LINKS = {
  single: import.meta.env.VITE_STRIPE_LINK_1 || '',
  pack5: import.meta.env.VITE_STRIPE_LINK_5 || '',
  unlimited: import.meta.env.VITE_STRIPE_LINK_UNLIMITED || '',
};

interface CreditsModalContextValue {
  isOpen: boolean;
  openCreditsModal: () => void;
  closeCreditsModal: () => void;
}

const CreditsModalContext = createContext<CreditsModalContextValue | null>(null);

export function useCreditsModal() {
  const ctx = useContext(CreditsModalContext);
  if (!ctx) throw new Error('useCreditsModal must be used within CreditsModalProvider');
  return ctx;
}

export function CreditsModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const openCreditsModal = useCallback(() => setIsOpen(true), []);
  const closeCreditsModal = useCallback(() => setIsOpen(false), []);

  return (
    <CreditsModalContext.Provider value={{ isOpen, openCreditsModal, closeCreditsModal }}>
      {children}
      {isOpen && <CreditsModal onClose={closeCreditsModal} />}
    </CreditsModalContext.Provider>
  );
}

const TIERS = [
  {
    id: 'single',
    name: '1 Briefing',
    credits: '1 crédit',
    price: '0,50€',
    highlight: false,
    description: 'Pour un match précis',
    linkKey: 'single' as const,
  },
  {
    id: 'pack5',
    name: '5 Briefings',
    credits: '5 crédits',
    price: '1,99€',
    highlight: true,
    description: '0,40€ par briefing — le bon plan',
    badge: 'Populaire',
    linkKey: 'pack5' as const,
  },
  {
    id: 'unlimited',
    name: 'Briefing illimité',
    credits: 'Pass illimité',
    price: '14,99€',
    highlight: false,
    description: 'Tous les matchs, zéro limite',
    linkKey: 'unlimited' as const,
  },
] as const;

function CreditsModal({ onClose }: { onClose: () => void }) {
  const { user, credits, hasFullPass } = useAuth();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handlePurchase = (linkKey: 'single' | 'pack5' | 'unlimited') => {
    const baseUrl = STRIPE_LINKS[linkKey];
    if (!baseUrl) {
      alert('Paiement bientôt disponible !');
      return;
    }
    const url = user ? `${baseUrl}?client_reference_id=${user.id}` : baseUrl;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-wc-card border border-wc-border rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black italic text-wc-text">Recharger tes crédits</h2>
            <p className="text-xs text-wc-muted mt-0.5">
              {hasFullPass
                ? 'Tu as le pass illimité — t\'es tranquille.'
                : `Il te reste ${credits} crédit${credits !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-wc-dark/60 text-wc-muted hover:text-wc-text transition cursor-pointer"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-wc-text/80 text-center italic">
          Pour deux pintes t'es assuré de tuer tes potes.
        </p>

        <div className="space-y-3">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`relative rounded-xl p-4 border transition ${
                tier.highlight
                  ? 'border-wc-gold/50 bg-wc-gold/5'
                  : 'border-wc-border/60 bg-wc-dark/30 hover:border-wc-border'
              }`}
            >
              {tier.highlight && 'badge' in tier && (
                <span className="absolute -top-2.5 left-4 bg-wc-gold text-wc-dark text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                  {tier.badge}
                </span>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold italic ${tier.highlight ? 'text-wc-gold' : 'text-wc-text'}`}>
                      {tier.name}
                    </span>
                    <span className="text-xs text-wc-muted">{tier.credits}</span>
                  </div>
                  <p className="text-[11px] text-wc-muted/70 mt-0.5">{tier.description}</p>
                </div>
                <button
                  onClick={() => handlePurchase(tier.linkKey)}
                  className={`shrink-0 text-xs font-bold px-4 py-2 rounded-lg transition cursor-pointer ${
                    tier.highlight
                      ? 'bg-wc-gold text-wc-dark hover:bg-wc-gold/80'
                      : 'border border-wc-border text-wc-text hover:border-wc-gold/50 hover:text-wc-gold'
                  }`}
                >
                  {tier.price}
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-wc-muted/50 text-center">
          Paiement sécurisé via Stripe. Les crédits sont ajoutés instantanément.
        </p>
      </div>
    </div>
  );
}
