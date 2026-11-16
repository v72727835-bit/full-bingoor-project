import React, { useEffect, useState } from 'react';
import { fetchIntegrations, IntegrationsView, saveIntegrations, testRazorpayKeys, testRazorpayx, testShiprocket } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { Badge, Button, CenterSpinner, ErrorBanner, Field } from '../components/ui';

const GOOGLE_ID = /^[\w-]+\.apps\.googleusercontent\.com$/;
const FB_ID = /^\d{5,20}$/;

/**
 * Keys for "Continue with Google / Facebook" and for online payment (Razorpay),
 * typed here instead of on the server. Secrets are stored encrypted and are never
 * shown again: a saved secret only says "saved", and a new one replaces it.
 */
export default function IntegrationsPage() {
  const [data, setData] = useState<IntegrationsView | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');

  const [google, setGoogle] = useState('');
  const [fbId, setFbId] = useState('');
  const [fbSecret, setFbSecret] = useState('');
  const [igId, setIgId] = useState('');
  const [igSecret, setIgSecret] = useState('');
  const [rzId, setRzId] = useState('');
  const [rzSecret, setRzSecret] = useState('');
  const [rzOn, setRzOn] = useState(true);
  const [srEmail, setSrEmail] = useState('');
  const [srPass, setSrPass] = useState('');
  const [srPickup, setSrPickup] = useState('');
  const [srChannel, setSrChannel] = useState('');
  const [srOn, setSrOn] = useState(false);
  const [rxAcct, setRxAcct] = useState('');
  const [rxKeyId, setRxKeyId] = useState('');
  const [rxSecret, setRxSecret] = useState('');
  const [rxWebhook, setRxWebhook] = useState('');
  const [rxOn, setRxOn] = useState(false);
  const [rxAuto, setRxAuto] = useState(false);
  const [mapsKey, setMapsKey] = useState('');

  const apply = (d: IntegrationsView) => {
    setData(d);
    setGoogle(d.googleClientId);
    setFbId(d.facebookAppId);
    setIgId(d.instagramAppId ?? '');
    setIgSecret('');
    setRzId(d.razorpayKeyId);
    setRzOn(d.razorpayEnabled);
    setSrEmail(d.shiprocketEmail);
    setSrPickup(d.shiprocketPickupLocation);
    setSrChannel(d.shiprocketChannelId);
    setSrOn(d.shiprocketEnabled);
    setRxAcct(d.razorpayxAccountNumber);
    setRxKeyId(d.razorpayxKeyId);
    setRxOn(d.razorpayxEnabled);
    setRxAuto(d.razorpayxAutoPayout);
    setMapsKey(d.googleMapsApiKey);
    setFbSecret('');
    setRzSecret('');
    setSrPass('');
    setRxSecret('');
  };

  useEffect(() => {
    fetchIntegrations().then(apply).catch((e) => setError(getErrorMessage(e)));
  }, []);

  const save = async (which: string, body: Record<string, unknown>, done: string) => {
    setBusy(which);
    setError('');
    setNote('');
    try {
      apply(await saveIntegrations(body));
      setNote(done);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy('');
    }
  };

  const test = async (fn: () => Promise<string> = testRazorpayKeys) => {
    setBusy('test');
    setError('');
    setNote('');
    try {
      setNote(await fn());
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy('');
    }
  };

  if (!data) return error ? <ErrorBanner message={error} /> : <CenterSpinner />;

  const status = (on: boolean) => (on ? <Badge tone="success">Working</Badge> : <Badge tone="muted">Not set up</Badge>);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Login &amp; Payments</h1>
          <div className="page-subtitle">
            Add your keys here and they start working on the website and the app within a few seconds. No server change is needed. Secrets are stored encrypted and are never shown again.
          </div>
        </div>
      </div>
      <ErrorBanner message={error} />
      {note && <div className="badge badge-success" style={{ marginBottom: 12 }}>{note}</div>}

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h2 className="card-title">
          Continue with Gmail {status(data.live.google)}
        </h2>
        <div className="page-subtitle" style={{ marginBottom: 12 }}>
          Google Cloud Console → APIs &amp; Services → Credentials → OAuth client ID (Web). Add https://bingoor.com as an authorised JavaScript origin.
        </div>
        <Field label="Google Client ID">
          <input value={google} onChange={(e) => setGoogle(e.target.value)} placeholder="1234567890-abc.apps.googleusercontent.com" autoComplete="off" />
        </Field>
        {google.trim() && !GOOGLE_ID.test(google.trim()) && (
          <div className="error-banner" style={{ marginBottom: 12 }}>
            {google.trim().startsWith('GOCSPX-')
              ? 'This is the Client secret, not the Client ID. Copy the Client ID instead (it ends in .apps.googleusercontent.com). Login with Google stays off until it is fixed.'
              : 'A Google Client ID ends in .apps.googleusercontent.com. Login with Google stays off until it is fixed.'}
          </div>
        )}
        <div className="modal-actions">
          <Button disabled={busy === 'google'} onClick={() => save('google', { googleClientId: google }, 'Google login saved.')}>
            {busy === 'google' ? 'Saving…' : 'Save Google'}
          </Button>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h2 className="card-title">
          Continue with Facebook {status(data.live.facebook)}
        </h2>
        <div className="page-subtitle" style={{ marginBottom: 12 }}>
          developers.facebook.com → your app → Settings → Basic. Turn on Facebook Login and add https://bingoor.com as a valid domain.
        </div>
        <div className="field-row">
          <Field label="Facebook App ID">
            <input value={fbId} onChange={(e) => setFbId(e.target.value)} placeholder="1234567890123456" autoComplete="off" inputMode="numeric" />
          </Field>
          <Field label={data.facebookSecretSaved ? 'App Secret (saved - type a new one to replace)' : 'App Secret'}>
            <input type="password" value={fbSecret} onChange={(e) => setFbSecret(e.target.value)} placeholder={data.facebookSecretSaved ? '••••••••••••' : ''} autoComplete="new-password" />
          </Field>
        </div>
        {fbId.trim() && !FB_ID.test(fbId.trim()) && (
          <div className="error-banner" style={{ marginBottom: 12 }}>
            The Facebook App ID is a number from developers.facebook.com (Settings → Basic), not an email. If your browser filled in your admin
            email and password here, clear both fields and paste the App ID and App Secret.
          </div>
        )}
        <div className="modal-actions">
          {data.facebookSecretSaved && (
            <Button variant="ghost" disabled={!!busy} onClick={() => save('fbclear', { clearFacebookSecret: true }, 'Facebook secret removed.')}>
              Remove saved secret
            </Button>
          )}
          <Button disabled={busy === 'fb'} onClick={() => save('fb', { facebookAppId: fbId, ...(fbSecret ? { facebookAppSecret: fbSecret } : {}) }, 'Facebook login saved.')}>
            {busy === 'fb' ? 'Saving…' : 'Save Facebook'}
          </Button>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h2 className="card-title">
          Continue with Instagram {status(!!data.live.instagram)}
        </h2>
        <div className="page-subtitle" style={{ marginBottom: 12 }}>
          developers.facebook.com → your app → add the <b>Instagram</b> product → <b>API setup with Instagram login</b> → copy the <b>Instagram app ID</b> and{' '}
          <b>Instagram app secret</b>. Under &ldquo;Set up Instagram business login&rdquo; add the redirect URL <b>https://bingoor.com/auth/instagram</b>. Note:
          Instagram allows this login only for Instagram <b>professional</b> (business / creator) accounts, and the app must be switched to Live.
        </div>
        <div className="field-row">
          <Field label="Instagram App ID">
            <input value={igId} onChange={(e) => setIgId(e.target.value)} placeholder="1234567890123456" autoComplete="off" inputMode="numeric" />
          </Field>
          <Field label={data.instagramSecretSaved ? 'Instagram App Secret (saved - type a new one to replace)' : 'Instagram App Secret'}>
            <input type="password" value={igSecret} onChange={(e) => setIgSecret(e.target.value)} placeholder={data.instagramSecretSaved ? '••••••••••••' : ''} autoComplete="new-password" />
          </Field>
        </div>
        {igId.trim() && !FB_ID.test(igId.trim()) && (
          <div className="error-banner" style={{ marginBottom: 12 }}>
            The Instagram App ID is a number from the Meta developer app (Instagram → API setup with Instagram login), not an email.
          </div>
        )}
        <div className="modal-actions">
          {data.instagramSecretSaved && (
            <Button variant="ghost" disabled={!!busy} onClick={() => save('igclear', { clearInstagramSecret: true }, 'Instagram secret removed.')}>
              Remove saved secret
            </Button>
          )}
          <Button disabled={busy === 'ig'} onClick={() => save('ig', { instagramAppId: igId, ...(igSecret ? { instagramAppSecret: igSecret } : {}) }, 'Instagram login saved.')}>
            {busy === 'ig' ? 'Saving…' : 'Save Instagram'}
          </Button>
        </div>
      </div>

      <div className="card card-pad">
        <h2 className="card-title">
          Online payment (Razorpay) {status(data.live.razorpay)}
        </h2>
        <div className="page-subtitle" style={{ marginBottom: 12 }}>
          dashboard.razorpay.com → Account &amp; Settings → API Keys. Use test keys (rzp_test_…) first, then switch to live keys (rzp_live_…) when you are ready.
        </div>
        <div className="field-row">
          <Field label="Razorpay Key ID">
            <input value={rzId} onChange={(e) => setRzId(e.target.value)} placeholder="rzp_test_xxxxxxxxxxxxxx" />
          </Field>
          <Field label={data.razorpaySecretSaved ? 'Key Secret (saved - type a new one to replace)' : 'Key Secret'}>
            <input type="password" value={rzSecret} onChange={(e) => setRzSecret(e.target.value)} placeholder={data.razorpaySecretSaved ? '••••••••••••' : ''} autoComplete="new-password" />
          </Field>
        </div>
        <label className="checkbox-row" style={{ marginBottom: 8 }}>
          <input type="checkbox" checked={rzOn} onChange={(e) => setRzOn(e.target.checked)} />
          <span>Show “Pay online” at checkout</span>
        </label>
        <div className="modal-actions">
          <Button variant="secondary" disabled={busy === 'test'} onClick={() => test()}>
            {busy === 'test' ? 'Checking…' : 'Test saved keys'}
          </Button>
          {data.razorpaySecretSaved && (
            <Button variant="ghost" disabled={!!busy} onClick={() => save('rzclear', { clearRazorpaySecret: true }, 'Razorpay secret removed.')}>
              Remove saved secret
            </Button>
          )}
          <Button
            disabled={busy === 'rz'}
            onClick={() => save('rz', { razorpayKeyId: rzId, razorpayEnabled: rzOn, ...(rzSecret ? { razorpayKeySecret: rzSecret } : {}) }, 'Razorpay saved. Press “Test saved keys” to check them.')}
          >
            {busy === 'rz' ? 'Saving…' : 'Save Razorpay'}
          </Button>
        </div>
      </div>

      <div className="card card-pad">
        <h2 className="card-title">
          Shiprocket courier {status(data.live.shiprocket)}
        </h2>
        <div className="page-subtitle" style={{ marginBottom: 12 }}>
          app.shiprocket.in → Settings → API → Configure → <b>Create an API User</b>. Paste that API user&apos;s email and the password it shows you (it is shown only once). The pickup location name must match exactly the one set in your Shiprocket account (Settings → Company → Pickup Addresses).
        </div>
        <div className="field-row">
          <Field label="API user email">
            <input value={srEmail} onChange={(e) => setSrEmail(e.target.value)} placeholder="info@bingoor.com" autoComplete="off" />
          </Field>
          <Field label={data.shiprocketPasswordSaved ? 'API password (saved - type a new one to replace)' : 'API password'}>
            <input type="password" value={srPass} onChange={(e) => setSrPass(e.target.value)} placeholder={data.shiprocketPasswordSaved ? '••••••••••••' : ''} autoComplete="off" />
          </Field>
        </div>
        <div className="field-row">
          <Field label="Pickup location name">
            <input value={srPickup} onChange={(e) => setSrPickup(e.target.value)} placeholder="Primary" />
          </Field>
          <Field label="Channel ID (optional)">
            <input value={srChannel} onChange={(e) => setSrChannel(e.target.value)} placeholder="leave blank for default" />
          </Field>
        </div>
        <label className="checkbox-row" style={{ marginBottom: 8 }}>
          <input type="checkbox" checked={srOn} onChange={(e) => setSrOn(e.target.checked)} />
          <span>Show “Send to Shiprocket” when assigning an order</span>
        </label>
        <div className="modal-actions">
          <Button variant="secondary" disabled={busy === 'test'} onClick={() => test(testShiprocket)}>
            {busy === 'test' ? 'Checking…' : 'Test connection'}
          </Button>
          {data.shiprocketPasswordSaved && (
            <Button variant="ghost" disabled={!!busy} onClick={() => save('srclear', { clearShiprocketPassword: true, shiprocketEnabled: false }, 'Shiprocket password removed.')}>
              Remove saved password
            </Button>
          )}
          <Button
            disabled={busy === 'sr'}
            onClick={() =>
              save(
                'sr',
                { shiprocketEmail: srEmail, shiprocketPickupLocation: srPickup, shiprocketChannelId: srChannel, shiprocketEnabled: srOn, ...(srPass ? { shiprocketPassword: srPass } : {}) },
                'Shiprocket saved. Press “Test connection” to check it.',
              )
            }
          >
            {busy === 'sr' ? 'Saving…' : 'Save Shiprocket'}
          </Button>
        </div>
      </div>

      <div className="card card-pad">
        <h2 className="card-title">
          Rider payouts (RazorpayX) {status(data.live.razorpayx)}
        </h2>
        <div className="page-subtitle" style={{ marginBottom: 12 }}>
          x.razorpay.com → Settings → Developer Controls → API Keys (Key Id + Secret), and Banking for your RazorpayX <b>account number</b>. Your RazorpayX account must be KYC-activated for payouts. With this on, a rider withdrawal can be paid to their UPI/bank in one click from the Payouts page.
        </div>
        <div className="field-row">
          <Field label="RazorpayX account number">
            <input value={rxAcct} onChange={(e) => setRxAcct(e.target.value)} placeholder="2323XXXXXXXXXX" />
          </Field>
          <Field label="Key ID">
            <input value={rxKeyId} onChange={(e) => setRxKeyId(e.target.value)} placeholder="rzp_live_xxxxxxxx" autoComplete="off" />
          </Field>
        </div>
        <Field label={data.razorpayxSecretSaved ? 'Key Secret (saved - type a new one to replace)' : 'Key Secret'}>
          <input type="password" value={rxSecret} onChange={(e) => setRxSecret(e.target.value)} placeholder={data.razorpayxSecretSaved ? '••••••••••••' : ''} autoComplete="new-password" />
        </Field>
        <Field label={data.razorpayxWebhookSaved ? 'Webhook Secret (saved - type a new one to replace)' : 'Webhook Secret (from RazorpayX > Webhooks, for api.bingoor.com/api/v1/webhooks/razorpayx)'}>
          <input type="password" value={rxWebhook} onChange={(e) => setRxWebhook(e.target.value)} placeholder={data.razorpayxWebhookSaved ? '••••••••••••' : ''} autoComplete="new-password" />
        </Field>
        <label className="checkbox-row" style={{ marginBottom: 6 }}>
          <input type="checkbox" checked={rxOn} onChange={(e) => setRxOn(e.target.checked)} />
          <span>Enable RazorpayX payouts (show “Approve &amp; Pay” on the Payouts page)</span>
        </label>
        <label className="checkbox-row" style={{ marginBottom: 8 }}>
          <input type="checkbox" checked={rxAuto} onChange={(e) => setRxAuto(e.target.checked)} />
          <span>Pay automatically the moment a rider withdraws (no admin approval) — leave off for safer one-click approval</span>
        </label>
        <div className="modal-actions">
          <Button variant="secondary" disabled={busy === 'test'} onClick={() => test(testRazorpayx)}>
            {busy === 'test' ? 'Checking…' : 'Test connection'}
          </Button>
          {data.razorpayxSecretSaved && (
            <Button variant="ghost" disabled={!!busy} onClick={() => save('rxclear', { clearRazorpayxSecret: true, razorpayxEnabled: false, razorpayxAutoPayout: false }, 'RazorpayX secret removed.')}>
              Remove saved secret
            </Button>
          )}
          <Button
            disabled={busy === 'rx'}
            onClick={() =>
              save(
                'rx',
                { razorpayxAccountNumber: rxAcct, razorpayxKeyId: rxKeyId, razorpayxEnabled: rxOn, razorpayxAutoPayout: rxAuto, ...(rxSecret ? { razorpayxKeySecret: rxSecret } : {}), ...(rxWebhook ? { razorpayxWebhookSecret: rxWebhook } : {}) },
                'RazorpayX saved. Press “Test connection” to check it.',
              )
            }
          >
            {busy === 'rx' ? 'Saving…' : 'Save RazorpayX'}
          </Button>
        </div>
      </div>

      <div className="card card-pad">
        <h2 className="card-title">
          Google Maps {status(data.live.googleMaps)}
        </h2>
        <div className="page-subtitle" style={{ marginBottom: 12 }}>
          console.cloud.google.com → APIs &amp; Services → enable <b>Maps JavaScript API</b> and <b>Geocoding API</b> (Geocoding turns the customer&apos;s exact pin into the right street, area and PIN code) → Credentials → create an API key, and restrict it to your website domains (HTTP referrers). Paste it here and every map on the website, the customer app and the rider app switches to Google Maps. <b>Google Maps is required everywhere.</b> If the key is missing or unavailable, maps show an error and retry option.
        </div>
        <Field label="Google Maps API key">
          <input value={mapsKey} onChange={(e) => setMapsKey(e.target.value)} placeholder="AIza… (required for Google Maps)" autoComplete="off" />
        </Field>
        <div className="modal-actions">
          <Button
            disabled={busy === 'maps'}
            onClick={() => save('maps', { googleMapsApiKey: mapsKey }, mapsKey.trim() ? 'Google Maps key saved. Maps now use Google.' : 'Cleared — Google Maps needs a valid key before maps can load.')}
          >
            {busy === 'maps' ? 'Saving…' : 'Save Google Maps'}
          </Button>
        </div>
      </div>
    </>
  );
}
