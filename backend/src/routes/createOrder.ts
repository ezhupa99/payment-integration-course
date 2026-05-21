import { db } from "../db";
import { authenticate, createSdkOrder, type CreateSdkOrderPayload } from "../pokpay";

// POST /api/orders
// Body: { userId: number | null, amount: number, flow?: string, autoCapture?: boolean, ...PokPay SDK order fields }
export async function handleCreateOrder(body: any) {
    const flow = body.flow || (body.userId == null ? "guest_checkout" : "pay_with_saved");
    const autoCapture = body.autoCapture !== false; // default true
    try {
        const accessToken = await authenticate();
        const publicBaseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
        const orderPayload: CreateSdkOrderPayload = {
            amount: body.amount,
            currencyCode: "ALL",
            autoCapture,
            shippingCost: body.shippingCost ?? 0,
            expiresAfterMinutes: body.expiresAfterMinutes ?? 1440,
            ...(body.splitWith ? { splitWith: body.splitWith } : {}),
            ...(body.deeplink ? { deeplink: body.deeplink } : {}),
            ...(body.webhookUrl ? { webhookUrl: body.webhookUrl } : publicBaseUrl ? { webhookUrl: `${publicBaseUrl}/api/webhooks/pokpay` } : {}),
            ...(body.redirectUrl ? { redirectUrl: body.redirectUrl } : publicBaseUrl ? { redirectUrl: publicBaseUrl } : {}),
            ...(body.failRedirectUrl ? { failRedirectUrl: body.failRedirectUrl } : publicBaseUrl ? { failRedirectUrl: publicBaseUrl } : {}),
        };
        const orderResult = await createSdkOrder(accessToken, orderPayload);

        db.run(
            `INSERT INTO orders (user_id, pokpay_order_id, amount, status, raw_response)
       VALUES (?, ?, ?, ?, ?)`,
            [body.userId, orderResult.id, body.amount, "PENDING", JSON.stringify({ ...orderResult, request: orderPayload })]
        );

        return { success: true, orderId: orderResult.id, currencyCode: "ALL" };
    } catch (e: any) {
        throw e;
    }
}
