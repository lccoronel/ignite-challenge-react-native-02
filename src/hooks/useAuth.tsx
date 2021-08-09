import React, { useEffect, createContext, useContext, useState, ReactNode } from 'react';
import { DiscoveryDocument, makeRedirectUri, revokeAsync, startAsync } from 'expo-auth-session';
import { generateRandom } from 'expo-auth-session/build/PKCE';

import { api } from '../services/api';
import { Alert } from 'react-native';

interface User {
  id: number;
  display_name: string;
  email: string;
  profile_image_url: string;
}

interface AuthContextData {
  user: User;
  isLoggingOut: boolean;
  isLoggingIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

interface AuthProviderData {
  children: ReactNode;
}

const AuthContext = createContext({} as AuthContextData);

const twitchEndpoints = {
  authorization: 'https://id.twitch.tv/oauth2/authorize',
  revocation: 'https://id.twitch.tv/oauth2/revoke'
};

function AuthProvider({ children }: AuthProviderData) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [user, setUser] = useState({} as User);
  const [userToken, setUserToken] = useState('');

  const { CLIENT_ID } = process.env;

  useEffect(() => {
    api.defaults.headers['Client-Id'] = CLIENT_ID;
  }, [])

  async function signIn() {
    try {
      setIsLoggingIn(true)

      const REDIRECT_URI = makeRedirectUri({ useProxy: true });
      const RESPONSE_TYPE = 'token';
      const SCOPE = encodeURI('openid user:read:email user:read:follows');
      const FORCE_VERIFY = true;
      const STATE = generateRandom(30);

      const authUrl = twitchEndpoints.authorization + 
        `?client_id=${CLIENT_ID}` + 
        `&redirect_uri=${REDIRECT_URI}` + 
        `&response_type=${RESPONSE_TYPE}` + 
        `&scope=${SCOPE}` + 
        `&force_verify=${FORCE_VERIFY}` +
        `&state=${STATE}`;

      const responseAuth = await startAsync({ authUrl });
      
      if (responseAuth && responseAuth.type !== 'success') {
        throw new Error('Deu ruim')
      }

      setUserToken(responseAuth.params.access_token)

      if (responseAuth.params.state !== STATE) {
        throw new Error('Deu ruim params')
      }

      api.defaults.headers.authorization = `Bearer ${responseAuth.params.access_token}`;

      const userResponse = await api.get('/users');
      setUser(userResponse.data.data[0])
    } catch (error) {
      Alert.alert(error)
    } finally {
      setIsLoggingIn(false)
    }
  }

  async function signOut() {
    try {
      setIsLoggingIn(true)

      const config = {
        token: userToken, clientId: CLIENT_ID
      }

      const dicovery = {
        revocationEndpoint: twitchEndpoints.revocation,
      }

      await revokeAsync(config, dicovery);
    } catch (error) {
    } finally {
      setUserToken('')
      setUser({} as User)

      delete api.defaults.headers.authorization;

      setIsLoggingIn(false)
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoggingOut, isLoggingIn, signIn, signOut }}>
      { children }
    </AuthContext.Provider>
  )
}

function useAuth() {
  const context = useContext(AuthContext);

  return context;
}

export { AuthProvider, useAuth };
