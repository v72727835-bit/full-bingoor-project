import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';

export async function googleAccessToken(webClientId: string): Promise<string> {
  GoogleSignin.configure({ webClientId, scopes: ['email', 'profile'] });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  if (!isSuccessResponse(result)) throw new Error('Google sign-in was closed.');
  const token = (await GoogleSignin.getTokens()).idToken;
  if (!token) throw new Error('Google did not return a login token. Please check the Google client ID.');
  return token;
}
