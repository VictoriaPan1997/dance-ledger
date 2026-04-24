import React, { useState, useEffect } from 'react';
import { supabase } from './supabase.js';

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Geist+Mono:wght@400..600&display=swap');`;

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{ minHeight: '100vh', background: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{FONTS}</style>
        <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', color: '#78716C' }}>Loading…</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ minHeight: '100vh', background: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
        <style>{FONTS}</style>
        <style>{`* { box-sizing: border-box; } body, html { margin: 0; padding: 0; } input:focus-visible { outline: 2px solid #A84E3C; outline-offset: 2px; }`}</style>
        <div style={{ maxWidth: '380px', width: '100%' }}>
          <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', letterSpacing: '0.14em', color: '#A84E3C', textTransform: 'uppercase', marginBottom: '12px' }}>
            Dance Studio · Vila
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '36px', fontWeight: 400, letterSpacing: '-0.02em', margin: '0 0 8px', color: '#1C1917' }}>
            Sign in
          </h1>
          <p style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontSize: '14px', color: '#78716C', margin: '0 0 32px' }}>
            We'll send a magic link to your email — tap it and you're in.
          </p>

          {!sent ? (
            <form onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              await supabase.auth.signInWithOtp({
                email,
                options: { emailRedirectTo: window.location.origin },
              });
              setSent(true);
              setLoading(false);
            }}>
              <label style={{ display: 'block', fontFamily: "'Geist Mono', monospace", fontSize: '10px', color: '#78716C', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '7px' }}>
                Email
              </label>
              <input
                autoFocus
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{ width: '100%', padding: '10px 13px', background: 'transparent', border: '1px solid #D6CCB8', borderRadius: '2px', fontSize: '14px', color: '#1C1917', fontFamily: 'inherit', marginBottom: '16px' }}
              />
              <button
                type="submit"
                disabled={loading || !email}
                style={{ width: '100%', padding: '12px', background: loading || !email ? '#D6CCB8' : '#1C1917', color: '#F5F0E8', border: 'none', borderRadius: '2px', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit', cursor: loading || !email ? 'default' : 'pointer', transition: 'background 150ms' }}
              >
                {loading ? 'Sending…' : 'Send magic link'}
              </button>
            </form>
          ) : (
            <div style={{ padding: '20px 22px', background: '#F5E0DA', borderRadius: '2px', borderLeft: '2px solid #A84E3C' }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: '16px', color: '#A84E3C', marginBottom: '6px' }}>Check your inbox</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontSize: '13px', color: '#78716C' }}>
                Tap the link in the email to sign in. On iPhone, make sure to open it in Safari.
              </div>
              <button
                onClick={() => { setSent(false); setEmail(''); }}
                style={{ marginTop: '14px', background: 'none', border: 'none', fontFamily: "'Geist Mono', monospace", fontSize: '10px', color: '#A84E3C', letterSpacing: '0.08em', cursor: 'pointer', padding: 0, textTransform: 'uppercase' }}
              >
                ← Use a different email
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return children(session.user);
}
