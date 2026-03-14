'use client';
import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0d0d1a] selection:bg-green-500/30">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden hero-gradient">
        {/* Animated Background Image */}
        <div className="absolute inset-0 z-0">
          <Image 
            src="/cricket_turf_hero_1773406468702.png" 
            alt="Cricket Turf" 
            fill
            className="object-cover opacity-40 mix-blend-overlay scale-110 animate-[pulse_8s_ease-in-out_infinite]"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0d0d1a]/50 via-transparent to-[#0d0d1a]" />
        </div>

        <div className="absolute inset-0 pointer-events-none overflow-hidden hidden md:block">
          <div className="absolute top-[20%] left-[10%] text-6xl opacity-20 animate-float">🏏</div>
          <div className="absolute bottom-[20%] right-[10%] text-6xl opacity-20 animate-float-delayed">🔴</div>
          <div className="absolute top-[40%] right-[15%] text-4xl opacity-10 animate-float">🏟️</div>
          <div className="absolute bottom-[40%] left-[15%] text-4xl opacity-10 animate-float-delayed">🔥</div>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 text-sm font-bold mb-8 animate-shine">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse"></span>
            THE ULTIMATE CRICKET EXPERIENCE
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-8xl font-black text-white mb-6 md:mb-8 leading-[1.1] tracking-tighter">
            Play Like a Pro on <br className="hidden sm:block" />
            <span className="text-glow" style={{ background: 'linear-gradient(135deg, #22c55e, #4ade80)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Elite Turfs
            </span>
          </h1>

          <p className="text-lg md:text-2xl text-slate-300 max-w-3xl mx-auto mb-10 md:mb-12 leading-relaxed font-medium">
            Book premium cricket & sports turfs with real-time slot availability. 
            International standard lighting, tournament-grade pitches.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 md:gap-6 justify-center items-center">
            <Link href="/browse" className="btn-primary text-lg md:text-xl py-4 md:py-5 px-8 md:px-10 rounded-2xl animate-shine shadow-[0_0_30px_rgba(34,197,94,0.3)] w-full sm:w-auto text-center">
              🏟️ Book Your Slot Now
            </Link>
            <Link href="/register?role=owner" className="group text-white font-bold text-base md:text-lg flex items-center gap-2 hover:text-green-400 transition-colors">
              List Your Turf <span className="group-hover:translate-x-2 transition-transform">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Image Section */}
      <section className="py-12 md:py-24 px-4 md:px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="relative group">
                <div className="absolute -inset-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000" />
                <div className="relative overflow-hidden rounded-3xl border border-white/10 aspect-video">
                  <Image 
                    src="/cricket_ball_close_up_1773406505546.png" 
                    alt="Cricket Precision" 
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-6 md:p-8">
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-2">Tournament Grade Quality</h3>
                      <p className="text-slate-300 text-sm">Experience the perfect bounce and spin on our specialized cricket turfs.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-8 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
                Why Choose <span className="text-green-400">TurfBook?</span>
              </h2>
              
              <div className="space-y-6">
                {[
                  { title: 'Instant Booking', desc: 'No more phone calls. Book your preferred slot in 30 seconds.', icon: '⚡' },
                  { title: 'Night Matches', desc: 'Powerful HD floodlights for the perfect day-night match feel.', icon: '🌙' },
                  { title: 'Secure App', desc: 'Manage everything from bookings to cancellations on the go.', icon: '📱' },
                  { title: 'Safe Payments', desc: 'Secure online transactions with instant confirmations.', icon: '🔒' }
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-5 p-6 rounded-2xl bg-white/5 border border-white/10 glass-card-hover">
                    <div className="text-4xl">{item.icon}</div>
                    <div>
                      <h4 className="text-xl font-bold text-white mb-1">{item.title}</h4>
                      <p className="text-slate-400">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section with Pulse */}
      <section className="py-12 md:py-20 bg-green-500/5 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
            {[
              { label: 'Turfs', value: '150+' },
              { label: 'Active Players', value: '25k+' },
              { label: 'Games Played', value: '100k+' },
              { label: 'Cities', value: '40+' }
            ].map((stat, i) => (
              <div key={i} className="text-center group">
                <div className="text-4xl md:text-5xl font-black text-white mb-2 group-hover:text-green-400 transition-colors">
                  {stat.value}
                </div>
                <div className="text-green-500/60 font-bold uppercase tracking-widest text-xs">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Action Section */}
      <section className="py-12 md:py-24 px-4 md:px-6 relative overflow-hidden">
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="glass-card p-8 md:p-20 text-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-50" />
            
            <Image 
              src="/players_on_turf_1773406654926.png" 
              alt="Action" 
              fill
              className="object-cover opacity-10 group-hover:opacity-20 transition-opacity duration-700"
            />

            <div className="relative z-10">
              <h2 className="text-3xl md:text-6xl font-black text-white mb-6">Own a Turf Facility?</h2>
              <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10">
                Join India&apos;s fastest growing sports network. Manage slots, track revenue, and grow your business with our pro dashboard.
              </p>
              <Link href="/register?role=owner" className="btn-outline text-base sm:text-lg md:text-xl py-4 px-4 md:px-12 rounded-2xl border-2 hover:bg-green-500 hover:text-white transition-all inline-flex justify-center items-center w-full sm:w-auto text-center">
                List Your Facility Today
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Simple Footer */}
      <footer className="py-12 border-t border-white/5 text-center px-6">
        <div className="flex justify-center gap-8 mb-8 text-slate-400 font-bold text-sm tracking-widest">
          <Link href="/browse" className="hover:text-green-400">BROWSE</Link>
          <Link href="/login" className="hover:text-green-400">LOGIN</Link>
          <Link href="/register" className="hover:text-green-400">JOIN</Link>
        </div>
        <p className="text-slate-600 text-sm">© 2024 TURFBOOK. DESIGNED FOR CHAMPIONS.</p>
      </footer>
    </div>
  );
}
