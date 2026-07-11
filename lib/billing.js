// Billing / license activation removed. Stubs keep existing message handlers safe.

export function billingEnabled() {
  return false;
}

export function purchaseUrl() {
  return "";
}

export async function syncProStatus() {
  return { active: true, billingEnabled: false };
}

export async function activateLicense(_key) {
  return {
    ok: false,
    error: "BILLING_DISABLED",
    message: "License billing is disabled."
  };
}

export async function removeLicense() {
  return { ok: true };
}

export async function licenseInfo() {
  return {
    billingEnabled: false,
    purchaseUrl: "",
    hasKey: false,
    active: true,
    plan: "",
    expiresAt: null
  };
}
