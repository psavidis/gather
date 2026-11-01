function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not set at build time`);
  return value;
}

export const config = {
  googleClientId: required('VITE_GOOGLE_CLIENT_ID', import.meta.env.VITE_GOOGLE_CLIENT_ID),
  backendUrl: required('VITE_BACKEND_URL', import.meta.env.VITE_BACKEND_URL),
};
