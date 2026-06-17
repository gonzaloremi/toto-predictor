export function InAppBrowserModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-wc-card border border-wc-border rounded-2xl p-6 max-w-sm w-full space-y-4 text-center">
        <div className="text-4xl">🔒</div>
        <h3 className="text-lg font-extrabold text-wc-text">Ouvre dans ton navigateur</h3>
        <p className="text-sm text-wc-muted">
          Google bloque la connexion depuis Messenger/Instagram. Ouvre le lien dans Safari ou Chrome pour te connecter.
        </p>
        <div className="space-y-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.origin).catch(() => {});
            }}
            className="w-full text-sm font-bold text-wc-dark bg-wc-gold hover:bg-wc-gold/80 transition px-4 py-3 rounded-xl cursor-pointer"
          >
            Copier le lien
          </button>
          <p className="text-[11px] text-wc-muted/60">
            Puis colle-le dans Safari ou Chrome
          </p>
          <button
            onClick={onClose}
            className="text-xs text-wc-muted hover:text-wc-text transition cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
