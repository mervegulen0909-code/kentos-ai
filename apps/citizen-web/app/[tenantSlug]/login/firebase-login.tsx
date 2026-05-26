'use client';

import { useState } from 'react';
import {
  GoogleAuthProvider,
  PhoneAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  type ConfirmationResult,
} from 'firebase/auth';
import { getFirebaseAuth } from '../../../lib/firebase';

type Props = {
  tenantSlug: string;
  redirectTo: string;
};

type Step = 'idle' | 'phone-input' | 'otp-input' | 'loading' | 'error';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

export function FirebaseLogin({ tenantSlug, redirectTo }: Props) {
  const [step, setStep] = useState<Step>('idle');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function saveSessionAndRedirect(idToken: string) {
    const res = await fetch(`/${tenantSlug}/login/set-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'KentOS' },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) throw new Error('Oturum kaydedilemedi');
    window.location.href = redirectTo;
  }

  async function handleGoogle() {
    setStep('loading');
    setErrorMsg('');
    try {
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      await saveSessionAndRedirect(idToken);
    } catch (err) {
      setErrorMsg(friendlyError(err));
      setStep('error');
    }
  }

  async function handleSendOtp() {
    const normalized = phone.trim().replace(/\s/g, '');
    if (!/^\+?[0-9]{10,15}$/.test(normalized)) {
      setErrorMsg('Geçerli bir telefon numarası girin (örn. +905551112233).');
      setStep('error');
      return;
    }
    setStep('loading');
    setErrorMsg('');
    try {
      const auth = getFirebaseAuth();
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      }
      const result = await signInWithPhoneNumber(auth, normalized.startsWith('+') ? normalized : `+90${normalized}`, window.recaptchaVerifier);
      setConfirmation(result);
      setStep('otp-input');
    } catch (err) {
      setErrorMsg(friendlyError(err));
      setStep('error');
      window.recaptchaVerifier = undefined;
    }
  }

  async function handleVerifyOtp() {
    if (!confirmation) return;
    setStep('loading');
    setErrorMsg('');
    try {
      const result = await confirmation.confirm(otp.trim());
      const idToken = await result.user.getIdToken();
      await saveSessionAndRedirect(idToken);
    } catch (err) {
      setErrorMsg(friendlyError(err));
      setStep('otp-input');
    }
  }

  function friendlyError(err: unknown): string {
    const code = (err as { code?: string })?.code ?? '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return '';
    if (code === 'auth/popup-blocked') return 'Giriş penceresi engellendi. Açılır pencereye izin verip tekrar deneyin.';
    if (code === 'auth/unauthorized-domain') return 'Bu yerel adres Google girişi için Firebase üzerinde yetkilendirilmemiş.';
    if (code === 'auth/operation-not-allowed') return 'Bu giriş yöntemi Firebase projesinde etkin değil.';
    if (code === 'auth/network-request-failed') return 'Kimlik doğrulama servisine ulaşılamadı. Tekrar deneyin.';
    if (code === 'auth/invalid-phone-number') return 'Telefon numarası geçersiz.';
    if (code === 'auth/invalid-verification-code') return 'Doğrulama kodu hatalı.';
    if (code === 'auth/code-expired') return 'Kod süresi doldu. Yeniden gönderin.';
    if (code === 'auth/too-many-requests') return 'Çok fazla deneme. Lütfen bekleyin.';
    return 'Giriş yapılamadı. Tekrar deneyin.';
  }

  const isLoading = step === 'loading';

  return (
    <div className="card" style={{ maxWidth: 400, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 8 }}>Giriş yap</h2>
      <p style={{ color: 'var(--muted)', marginBottom: 24, fontSize: '0.9rem' }}>
        Başvurularınızı takip edebilmek için giriş yapın.
      </p>

      {(step === 'error' && errorMsg) ? (
        <div className="notice error" role="alert" style={{ marginBottom: 16 }}>
          <strong>{errorMsg}</strong>
        </div>
      ) : null}

      {/* Google */}
      {step !== 'phone-input' && step !== 'otp-input' ? (
        <button
          className="cta"
          style={{ width: '100%', marginBottom: 12, background: 'var(--fg)', color: 'var(--bg)' }}
          onClick={handleGoogle}
          disabled={isLoading}
          type="button"
        >
          {isLoading ? 'Bekleniyor…' : 'Google ile devam et'}
        </button>
      ) : null}

      {/* Telefon — numara adımı */}
      {step !== 'phone-input' && step !== 'otp-input' ? (
        <button
          className="cta"
          style={{ width: '100%', background: 'transparent', border: '1px solid var(--border)', color: 'var(--fg)' }}
          onClick={() => { setStep('phone-input'); setErrorMsg(''); }}
          disabled={isLoading}
          type="button"
        >
          Telefon ile devam et
        </button>
      ) : null}

      {step === 'phone-input' ? (
        <div>
          <div className="field">
            <label htmlFor="phone-input">Telefon numarası</label>
            <input
              id="phone-input"
              type="tel"
              inputMode="tel"
              placeholder="+905551112233"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
              autoComplete="tel"
            />
          </div>
          <div id="recaptcha-container" />
          <button className="cta" style={{ width: '100%' }} onClick={handleSendOtp} disabled={isLoading} type="button">
            {isLoading ? 'Gönderiliyor…' : 'Kod gönder'}
          </button>
          <button
            style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.85rem' }}
            onClick={() => { setStep('idle'); setPhone(''); }}
            type="button"
          >
            ← Geri
          </button>
        </div>
      ) : null}

      {/* OTP adımı */}
      {step === 'otp-input' ? (
        <div>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: 16 }}>
            <strong>{phone}</strong> numarasına doğrulama kodu gönderildi.
          </p>
          <div className="field">
            <label htmlFor="otp-input">Doğrulama kodu</label>
            <input
              id="otp-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              autoFocus
              autoComplete="one-time-code"
            />
          </div>
          <button className="cta" style={{ width: '100%' }} onClick={handleVerifyOtp} disabled={isLoading} type="button">
            {isLoading ? 'Doğrulanıyor…' : 'Doğrula ve giriş yap'}
          </button>
          <button
            style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.85rem' }}
            onClick={() => { setStep('phone-input'); setOtp(''); setConfirmation(null); }}
            type="button"
          >
            ← Kodu yeniden gönder
          </button>
        </div>
      ) : null}

      <p style={{ marginTop: 20, fontSize: '0.75rem', color: 'var(--muted)', textAlign: 'center' }}>
        Giriş yaparak KVKK kapsamında kişisel verilerinizin işlenmesini onaylarsınız.
      </p>
    </div>
  );
}
