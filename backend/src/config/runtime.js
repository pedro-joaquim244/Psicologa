function flag(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

export function demoModeEnabled() {
  return flag('DEMO_MODE');
}

export function emailDeliveryEnabled() {
  if (demoModeEnabled()) return false;
  const provider = String(process.env.EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? 'resend' : 'smtp')).trim().toLowerCase();
  return provider !== 'disabled' && provider !== 'none';
}

export function publicRegistrationEnabled() {
  if (demoModeEnabled()) return false;
  return flag('PUBLIC_REGISTRATION_ENABLED', emailDeliveryEnabled());
}

export function publicDemoLoginEnabled() {
  return demoModeEnabled() && flag('DEMO_PUBLIC_LOGIN', true);
}

export function publicRuntimeConfig() {
  const demoMode = demoModeEnabled();
  return {
    demoMode,
    emailDelivery: emailDeliveryEnabled(),
    publicRegistration: publicRegistrationEnabled(),
    demoAccess: {
      paciente: demoMode && publicDemoLoginEnabled(),
      profissional: demoMode && publicDemoLoginEnabled(),
    },
  };
}
