const BASE = process.env.POKPAY_ENV === "staging"
    ? "https://api-staging.pokpay.io"
    : "https://api.pokpay.io";

const MERCHANT_ID = process.env.POKPAY_MERCHANT_ID!;

export type AuthResponse = {
    accessToken: string;
    tokenType: string;
    expiresIn: number;
};

export type SdkOrderResponse = {
    id: string;
    [key: string]: unknown;
};

export type CreateSdkOrderPayload = {
    amount: number;
    currencyCode?: string;
    autoCapture?: boolean;
    splitWith?: { merchantId: string; amount: number };
    shippingCost?: number;
    webhookUrl?: string;
    redirectUrl?: string;
    failRedirectUrl?: string;
    deeplink?: string;
    expiresAfterMinutes?: number;
};

export type ThreeDSSetupResponse = {
    payerAuthentication: {
        threeDSServerTransID: string;
        acsURL: string;
        [key: string]: unknown;
    };
};

// Authenticates with PokPay
export async function authenticate(): Promise<string> {
    const res = await fetch(`${BASE}/auth/sdk/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            keyId: process.env.POKPAY_KEY_ID,
            keySecret: process.env.POKPAY_KEY_SECRET,
        }),
    });
    if (!res.ok) throw new Error(`Auth failed: ${await res.text()}`);
    const body = await res.json();
    return body.data.accessToken;
}

// Creates an SDK order. Required before rendering the guest checkout form.
export async function createSdkOrder(
    accessToken: string,
    payload: CreateSdkOrderPayload
): Promise<SdkOrderResponse> {
    const res = await fetch(`${BASE}/merchants/${MERCHANT_ID}/sdk-orders`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`Create order failed: ${raw}`);
    const body = JSON.parse(raw);
    return body.data.sdkOrder;
}

export async function getSdkOrder(
    accessToken: string,
    orderId: string
): Promise<SdkOrderResponse> {
    const res = await fetch(`${BASE}/merchants/${MERCHANT_ID}/sdk-orders/${orderId}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`Get order failed: ${raw}`);
    const body = JSON.parse(raw);
    return body.data?.sdkOrder ?? body.data ?? body;
}

// Captures a previously-authorized SDK order. Use when the order was created with autoCapture=false.
// body: { amount: number, splitWith?: { merchantId: string, amount: number } }
export async function captureSdkOrder(
    accessToken: string,
    orderId: string,
    body: { amount: number; splitWith?: { merchantId: string; amount: number } }
): Promise<any> {
    const res = await fetch(`${BASE}/merchants/${MERCHANT_ID}/sdk-orders/${orderId}/capture`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`Capture failed: ${raw}`);
    return JSON.parse(raw).data;
}

// Sets up 3-D Secure for a saved card.
export async function setup3DS(
    accessToken: string,
    cardId: string,
    orderId: string
): Promise<ThreeDSSetupResponse> {
    const res = await fetch(`${BASE}/credit-debit-cards/${cardId}/setup-tokenized-3ds`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ sdkOrder: { id: orderId } }),
    });

    const raw = await res.text();

    if (!res.ok) throw new Error(`3DS setup failed: ${raw}`);
    return JSON.parse(raw).data;
}

// Tokenizes a guest card (JWE payload) into a permanent card
export async function tokenizeCard(
    accessToken: string,
    payload: any
): Promise<any> {
    const res = await fetch(`${BASE}/credit-debit-cards/tokenize-guest-card`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
    });

    const raw = await res.text();

    if (!res.ok) throw new Error(`Tokenize failed: ${raw}`);
    return JSON.parse(raw).data.creditDebitCard;
}
