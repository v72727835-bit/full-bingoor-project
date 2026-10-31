/**
 * Phone OTP through Firebase Auth (native SDK).
 *
 * The native Firebase packages are loaded lazily: an app build that does not
 * include them (or has no google-services.json yet) keeps working, it just
 * cannot show the OTP step, and the screen says so instead of crashing.
 */
interface Confirmation {
  confirm: (code: string) => Promise<{ user: { getIdToken: (forceRefresh?: boolean) => Promise<string> } } | null>;
}
interface FirebaseAuth {
  signInWithPhoneNumber: (phone: string) => Promise<Confirmation>;
  signOut: () => Promise<void>;
}

function loadAuth(): (() => FirebaseAuth) | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-firebase/auth').default as () => FirebaseAuth;
  } catch {
    return null;
  }
}

export const phoneOtpAvailable = () => loadAuth() !== null;

const toE164 = (phone: string) => {
  const d = phone.replace(/\D/g, '');
  return `+91${d.length > 10 ? d.slice(-10) : d}`;
};

function message(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('invalid-phone-number')) return 'That phone number is not valid.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Please wait a few minutes and try again.';
  if (code.includes('invalid-verification-code')) return 'That code is not correct. Please check the SMS and try again.';
  if (code.includes('session-expired') || code.includes('code-expired')) return 'That code has expired. Please request a new one.';
  if (code.includes('quota-exceeded')) return 'We cannot send more OTPs right now. Please try again later.';
  if (code.includes('network')) return 'No internet connection. Please try again.';
  return 'Could not send the OTP. Please try again.';
}

export interface OtpHandle {
  /** Checks the code and returns a Firebase ID token the server can verify. */
  confirm: (code: string) => Promise<string>;
}

export async function sendOtp(phone: string): Promise<OtpHandle> {
  const auth = loadAuth();
  if (!auth) throw new Error('Phone verification needs the latest version of the app. Please update it.');
  let confirmation: Confirmation;
  try {
    confirmation = await auth().signInWithPhoneNumber(toE164(phone));
  } catch (e) {
    throw new Error(message(e));
  }
  return {
    confirm: async (code: string) => {
      try {
        const cred = await confirmation.confirm(code.trim());
        if (!cred?.user) throw new Error('no user');
        const token = await cred.user.getIdToken(true);
        // The token is all the server needs; do not leave a Firebase session behind.
        await auth().signOut().catch(() => undefined);
        return token;
      } catch (e) {
        throw new Error(message(e));
      }
    },
  };
}
