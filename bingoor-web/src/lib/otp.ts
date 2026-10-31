import axios from 'axios';

/** If the server asked for an OTP, returns the phone number it wants verified. */
export function otpRequiredPhone(err: unknown): string | null {
  if (!axios.isAxiosError(err) || err.response?.status !== 428) return null;
  const d = (err.response.data as { details?: { code?: string; phone?: string } } | undefined)?.details;
  return d?.code === 'otp_required' ? d.phone ?? '' : null;
}
