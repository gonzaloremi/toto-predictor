import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LandingPage({ onEnterApp }: { onEnterApp: () => void }) {
  const { user, signInWithGoogle } = useAuth();
  const sectionsRef = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('opacity-100', 'translate-y-0');
            entry.target.classList.remove('opacity-0', 'translate-y-8');
          }
        });
      },
      { threshold: 0.1 }
    );

    sectionsRef.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const addRef = (el: HTMLDivElement | null) => {
    if (el && !sectionsRef.current.includes(el)) {
      sectionsRef.current.push(el);
    }
  };

  const handleCta = () => {
    if (user) {
      onEnterApp();
    } else {
      signInWithGoogle();
    }
  };

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-wc-border bg-wc-card/80 sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚽</span>
            <span className="text-xl font-extrabold italic text-wc-gold tracking-tight">MPP Brief</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onEnterApp}
              className="text-xs text-wc-muted hover:text-wc-text transition cursor-pointer"
            >
              Voir les matchs →
            </button>
            {user ? (
              <button
                onClick={onEnterApp}
                className="text-xs font-bold text-wc-dark bg-wc-gold hover:bg-wc-gold/80 transition px-4 py-2 rounded-lg cursor-pointer"
              >
                Ouvrir l'app
              </button>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="text-xs font-bold text-wc-dark bg-wc-gold hover:bg-wc-gold/80 transition px-4 py-2 rounded-lg cursor-pointer"
              >
                Essayer gratuitement
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="space-y-6">
          <div className="inline-block bg-wc-gold/10 border border-wc-gold/30 rounded-full px-4 py-1.5 mb-2">
            <span className="text-xs font-bold text-wc-gold uppercase tracking-wider">
              Coupe du Monde 2026
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black italic text-wc-text leading-tight">
            Écrase tes potes<br />
            <span className="text-wc-gold">à Mon Petit Prono.</span>
          </h1>
          <p className="text-lg md:text-xl text-wc-muted max-w-2xl mx-auto leading-relaxed">
            Ton briefing IA avant chaque match. Stats, historiques, analyse tactique, cotes
            — tout ce qu'il faut pour dominer ton classement MPP.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={handleCta}
              className="text-base font-bold text-wc-dark bg-wc-gold hover:bg-wc-gold/80 transition px-8 py-3.5 rounded-xl cursor-pointer shadow-lg shadow-wc-gold/20"
            >
              {user ? 'Accéder aux briefings' : 'Commencer gratuitement'}
            </button>
            <button
              onClick={onEnterApp}
              className="text-sm text-wc-muted hover:text-wc-text border border-wc-border hover:border-wc-gold/50 transition px-6 py-3 rounded-xl cursor-pointer"
            >
              Voir un exemple gratuit
            </button>
          </div>
          <p className="text-sm text-wc-gold/80 font-semibold pt-2">
            3 briefings offerts à l'inscription. Sans carte bancaire.
          </p>
        </div>
      </section>

      {/* What you get */}
      <section
        ref={addRef}
        className="max-w-5xl mx-auto px-4 py-16 opacity-0 translate-y-8 transition-all duration-700"
      >
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-black italic text-wc-text">
            Ce que tu reçois avant chaque match
          </h2>
          <p className="text-sm text-wc-muted mt-2">Un vrai briefing d'analyste, pas un résumé Wikipedia.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FeatureCard
            icon="📊"
            title="Stats & données"
            description="Classement FIFA, forme récente, confrontations directes, stats clés des deux équipes. Tout compilé automatiquement."
          />
          <FeatureCard
            icon="▶"
            title="Analyse Wiloo"
            description="Les meilleures analyses vidéo de la chaîne Wiloo, résumées et mises en contexte pour le match."
          />
          <FeatureCard
            icon="📰"
            title="Presse & So Foot"
            description="Les articles les plus pertinents de So Foot, résumés pour que tu aies le contexte sans lire 20 papiers."
          />
          <FeatureCard
            icon="🧠"
            title="Synthèse Claude Opus"
            description="GPT-4o-mini collecte les infos, Claude Opus 4.6 synthétise une analyse tactique complète avec pronostic argumenté."
          />
        </div>
      </section>

      {/* How it works */}
      <section
        ref={addRef}
        className="max-w-5xl mx-auto px-4 py-16 opacity-0 translate-y-8 transition-all duration-700"
      >
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-black italic text-wc-text">
            Comment ça marche
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StepCard
            step="1"
            emoji="🔑"
            title="Tu te connectes"
            description="Un clic avec Google et c'est parti. 3 briefings gratuits pour tester, sans sortir ta CB."
          />
          <StepCard
            step="2"
            emoji="📱"
            title="Tu reçois ton briefing"
            description="Avant chaque match, ton analyse complète est prête. Stats, contexte, pronostic — en 2 minutes tu sais tout."
          />
          <StepCard
            step="3"
            emoji="🏆"
            title="Tu écrases tes potes"
            description="Pendant qu'ils prononcent au feeling, toi t'as les données. Résultat : tu montes dans le classement MPP."
          />
        </div>
      </section>

      {/* Example briefing */}
      <section
        ref={addRef}
        className="max-w-5xl mx-auto px-4 py-16 opacity-0 translate-y-8 transition-all duration-700"
      >
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-black italic text-wc-text">
            À quoi ressemble un briefing
          </h2>
          <p className="text-sm text-wc-muted mt-2">Voici un extrait d'une analyse générée par l'agent.</p>
        </div>
        <div className="bg-wc-card border border-wc-border rounded-xl overflow-hidden max-w-3xl mx-auto">
          {/* Mock header */}
          <div className="bg-wc-green/20 border-b border-wc-border p-4">
            <div className="flex items-center justify-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-3xl">🇫🇷</span>
                <span className="text-lg font-bold italic">France</span>
              </div>
              <span className="text-wc-muted font-bold italic">vs</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold italic">Colombie</span>
                <span className="text-3xl">🇨🇴</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-[10px] text-wc-muted uppercase tracking-wider font-bold">Cotes</span>
              <span className="text-sm font-bold italic text-wc-gold">1.8</span>
              <span className="text-wc-muted text-xs">·</span>
              <span className="text-sm font-bold italic text-wc-text/80">3.4</span>
              <span className="text-wc-muted text-xs">·</span>
              <span className="text-sm font-bold italic text-wc-gold">4.2</span>
            </div>
          </div>
          {/* Mock prediction */}
          <div className="p-5 space-y-4">
            <div className="bg-wc-dark/50 border border-wc-gold/30 rounded-xl p-4 text-center space-y-2">
              <div className="text-[10px] text-wc-muted uppercase tracking-wider font-bold">Pronostic</div>
              <div className="flex items-center justify-center gap-4">
                <span className="text-2xl font-black italic text-wc-gold">2</span>
                <span className="text-sm text-wc-muted">-</span>
                <span className="text-2xl font-black italic text-wc-gold">1</span>
              </div>
              <div className="flex items-center justify-center gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} className="text-sm text-wc-gold">★</span>
                ))}
                <span className="text-sm text-wc-muted/30">★</span>
                <span className="text-[10px] text-wc-muted ml-1">Confiance</span>
              </div>
              <p className="text-xs text-wc-text/70 leading-relaxed max-w-md mx-auto">
                La France reste favorite à domicile avec un effectif plus complet, mais la Colombie est en grande forme.
                Victoire étriquée des Bleus grâce à leur expérience dans les grands tournois.
              </p>
            </div>
            {/* Mock key factors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="bg-wc-dark/30 border border-wc-border/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-wc-gold font-bold">🇫🇷 France</span>
                  <span className="text-xs text-wc-text font-semibold">Avantage terrain</span>
                </div>
                <p className="text-[11px] text-wc-text/60">Joue dans un stade américain mais avec 70% de supporters français attendus.</p>
              </div>
              <div className="bg-wc-dark/30 border border-wc-border/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-wc-gold font-bold">🇨🇴 Colombie</span>
                  <span className="text-xs text-wc-text font-semibold">Dynamique collective</span>
                </div>
                <p className="text-[11px] text-wc-text/60">Invaincue depuis 28 matchs, meilleure série en cours toutes sélections confondues.</p>
              </div>
            </div>
            {/* Mock Wiloo */}
            <div className="bg-wc-dark/40 border border-purple-500/20 rounded-lg p-3">
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Verdict Wiloo</span>
              <p className="text-xs text-purple-300/70 italic leading-relaxed border-l-2 border-purple-500/30 pl-3 mt-2">
                "La Colombie a un milieu de terrain monstrueux avec James qui revit, mais face à la charnière Saliba-Konaté,
                ça va être compliqué de se créer des occasions nettes."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Free tier CTA */}
      <section
        id="pricing"
        ref={addRef}
        className="max-w-5xl mx-auto px-4 py-16 opacity-0 translate-y-8 transition-all duration-700"
      >
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-black italic text-wc-text">
            Teste gratuitement. Décide après.
          </h2>
        </div>
        <div className="max-w-md mx-auto bg-wc-card border border-wc-gold/40 rounded-2xl p-8 text-center space-y-6 shadow-lg shadow-wc-gold/5">
          <div className="inline-block bg-wc-gold/10 border border-wc-gold/30 rounded-full px-3 py-1">
            <span className="text-xs font-bold text-wc-gold uppercase tracking-wider">3 briefings offerts</span>
          </div>
          <div>
            <span className="text-5xl font-black italic text-wc-gold">Gratuit</span>
            <p className="text-sm text-wc-muted mt-1">Aucune carte bancaire requise</p>
          </div>
          <ul className="text-left space-y-3 text-sm text-wc-text/80">
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold mt-0.5">✓</span>
              <span>3 briefings IA complets offerts à l'inscription</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold mt-0.5">✓</span>
              <span>Pronostic argumenté avec score et niveau de confiance</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold mt-0.5">✓</span>
              <span>Analyses Wiloo + presse sportive intégrées</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold mt-0.5">✓</span>
              <span>Cotes et contexte du groupe en temps réel</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 font-bold mt-0.5">✓</span>
              <span>Recharge de crédits ou pass illimité dispo ensuite</span>
            </li>
          </ul>
          <button
            onClick={handleCta}
            className="block w-full text-center text-base font-bold text-wc-dark bg-wc-gold hover:bg-wc-gold/80 transition py-4 rounded-xl cursor-pointer shadow-lg shadow-wc-gold/20"
          >
            {user ? 'Accéder à mes briefings →' : 'S\'inscrire avec Google →'}
          </button>
          <p className="text-[11px] text-wc-muted/60">
            Connexion en un clic via Google. Tes 3 briefings t'attendent.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section
        ref={addRef}
        className="max-w-5xl mx-auto px-4 py-16 opacity-0 translate-y-8 transition-all duration-700"
      >
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-black italic text-wc-text">
            Questions fréquentes
          </h2>
        </div>
        <div className="max-w-2xl mx-auto space-y-4">
          <FaqItem
            question="C'est quoi exactement ?"
            answer="Un agent IA qui compile stats, analyses vidéo (Wiloo), articles de presse (So Foot), et cotes pour te pondre un briefing complet avant chaque match de la Coupe du Monde 2026. GPT-4o-mini fait la collecte, Claude Opus 4.6 fait la synthèse finale."
          />
          <FaqItem
            question="C'est vraiment gratuit ?"
            answer="Oui, 3 briefings sont offerts à l'inscription. Ensuite tu peux acheter des crédits supplémentaires ou un pass illimité si tu veux continuer."
          />
          <FaqItem
            question="Combien de matchs sont couverts ?"
            answer="Tous. Les 104 matchs de la phase de groupes jusqu'à la finale. Tu reçois un briefing pour chaque match, pas juste ceux de la France."
          />
          <FaqItem
            question="Quand est-ce que je reçois le briefing ?"
            answer="Le briefing est disponible quelques heures avant le coup d'envoi. Tu as le temps de le lire, de faire ton prono sur MPP, et d'aller regarder le match tranquille."
          />
          <FaqItem
            question="C'est vraiment mieux que de faire mes pronos au feeling ?"
            answer="Honnêtement ? Les données ne mentent pas. L'IA agrège des sources que tu n'aurais jamais le temps de consulter toi-même. Ça ne garantit pas de gagner à chaque fois, mais sur 104 matchs, la régularité fait la différence dans un classement MPP."
          />
        </div>
      </section>

      {/* Footer CTA */}
      <section className="max-w-5xl mx-auto px-4 py-16 text-center">
        <div className="bg-wc-card border border-wc-border rounded-2xl p-10 space-y-4">
          <h2 className="text-xl md:text-2xl font-black italic text-wc-text">
            Prêt à dominer ton groupe MPP ? ⚽
          </h2>
          <p className="text-sm text-wc-muted">
            La Coupe du Monde commence bientôt. Tes potes ne sauront pas ce qui leur arrive.
          </p>
          <button
            onClick={handleCta}
            className="inline-block text-base font-bold text-wc-dark bg-wc-gold hover:bg-wc-gold/80 transition px-8 py-3.5 rounded-xl cursor-pointer shadow-lg shadow-wc-gold/20"
          >
            {user ? 'Accéder aux briefings' : 'Commencer gratuitement — 3 briefings offerts'}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-wc-border py-6 text-center">
        <p className="text-xs text-wc-muted/50">
          MPP Brief · Coupe du Monde 2026 · Pas affilié à la FIFA ni à Mon Petit Prono
        </p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-wc-card border border-wc-border rounded-xl p-5 space-y-3 hover:border-wc-gold/30 transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <h3 className="text-base font-bold italic text-wc-text">{title}</h3>
      </div>
      <p className="text-sm text-wc-muted leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({ step, emoji, title, description }: { step: string; emoji: string; title: string; description: string }) {
  return (
    <div className="bg-wc-card border border-wc-border rounded-xl p-6 text-center space-y-3 hover:border-wc-gold/30 transition-colors">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-wc-gold/10 border border-wc-gold/30">
        <span className="text-sm font-black italic text-wc-gold">{step}</span>
      </div>
      <div className="text-3xl">{emoji}</div>
      <h3 className="text-base font-bold italic text-wc-text">{title}</h3>
      <p className="text-sm text-wc-muted leading-relaxed">{description}</p>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group bg-wc-card border border-wc-border rounded-xl overflow-hidden">
      <summary className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-wc-dark/30 transition">
        <span className="text-sm font-bold text-wc-text">{question}</span>
        <span className="text-wc-muted text-lg transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="px-5 pb-4">
        <p className="text-sm text-wc-muted leading-relaxed">{answer}</p>
      </div>
    </details>
  );
}
