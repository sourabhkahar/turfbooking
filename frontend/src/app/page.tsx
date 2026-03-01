import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-hidden">
      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center justify-center text-center px-4">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.12) 0%, transparent 70%)' }} />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            Live bookings available now
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight tracking-tight">
            Book Your Perfect
            <span className="block" style={{ background: 'linear-gradient(135deg, #22c55e, #4ade80)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Sports Turf
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Find and book top-quality sports turfs near you instantly. Football, Cricket, Basketball & more.
            Real-time slot availability, flexible pricing.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/browse" className="btn-primary text-lg py-4 px-8">
              🏟️ Browse Turfs
            </Link>
            <Link href="/register?role=owner" className="btn-outline text-lg py-4 px-8">
              Register Your Turf
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { number: '200+', label: 'Turfs Listed', icon: '🏟️' },
            { number: '5000+', label: 'Happy Bookings', icon: '✅' },
            { number: '50+', label: 'Cities', icon: '🌆' },
            { number: '4.9★', label: 'Avg Rating', icon: '⭐' },
          ].map((stat) => (
            <div key={stat.label} className="glass-card p-6 text-center">
              <div className="text-3xl mb-2">{stat.icon}</div>
              <div className="text-3xl font-black text-green-400">{stat.number}</div>
              <div className="text-slate-400 text-sm mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-4">How It Works</h2>
          <p className="text-slate-400 text-center mb-12">Book your game in 3 simple steps</p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: '🔍', title: 'Browse Turfs', desc: 'Search available turfs by city, sport type, or name.' },
              { step: '02', icon: '📅', title: 'Pick a Slot', desc: 'View real-time availability and choose your preferred time slot.' },
              { step: '03', icon: '✅', title: 'Confirm & Play', desc: 'Instant booking confirmation. Just show up and play!' },
            ].map((s) => (
              <div key={s.step} className="glass-card p-8 relative">
                <div className="text-6xl font-black text-white/5 absolute top-4 right-4">{s.step}</div>
                <div className="text-4xl mb-4">{s.icon}</div>
                <h3 className="text-xl font-bold text-white mb-2">{s.title}</h3>
                <p className="text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Owners */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="glass-card p-10 md:p-16 flex flex-col md:flex-row items-center gap-10"
            style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(22,163,74,0.04))' }}>
            <div className="flex-1">
              <div className="badge badge-green mb-4">For Turf Owners</div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Grow Your Turf Business</h2>
              <p className="text-slate-400 leading-relaxed mb-6">
                Register your turf, set your own slot schedule, customize pricing per hour, block dates, and manage all bookings from one powerful dashboard.
              </p>
              <ul className="space-y-3 mb-8">
                {['Smart slot generator', 'Flexible per-hour pricing', 'Manual slot blocking', 'Booking management & analytics'].map(f => (
                  <li key={f} className="flex items-center gap-3 text-slate-300">
                    <span className="text-green-400 font-bold">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/register?role=owner" className="btn-primary">Register as Owner →</Link>
            </div>
            <div className="text-9xl hidden md:block">🏟️</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-4 text-center text-slate-500 text-sm">
        <p>© 2024 TurfBook · Built for sports lovers</p>
      </footer>
    </div>
  );
}
