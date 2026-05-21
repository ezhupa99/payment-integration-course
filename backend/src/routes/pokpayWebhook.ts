import { db } from "../db";

type LocalOrderStatus = "PENDING" | "PENDING_3DS" | "AUTHORIZED" | "CAPTURED" | "FAILED";

function firstString(...values: unknown[]): string | undefined {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) return value;
    }
}

function extractOrderId(payload: any): string | undefined {
    return firstString(
        payload?.orderId,
        payload?.sdkOrderId,
        payload?.sdkOrder?.id,
        payload?.order?.id,
        payload?.data?.orderId,
        payload?.data?.sdkOrderId,
        payload?.data?.sdkOrder?.id,
        payload?.data?.order?.id
    );
}

function extractGatewayStatus(payload: any): string | undefined {
    return firstString(
        payload?.status,
        payload?.event,
        payload?.type,
        payload?.paymentStatus,
        payload?.transactionStatus,
        payload?.sdkOrder?.status,
        payload?.order?.status,
        payload?.data?.status,
        payload?.data?.event,
        payload?.data?.type,
        payload?.data?.paymentStatus,
        payload?.data?.transactionStatus,
        payload?.data?.sdkOrder?.status,
        payload?.data?.order?.status
    );
}

function mapGatewayStatus(status: string | undefined): LocalOrderStatus {
    const normalized = status?.toUpperCase().replace(/[^A-Z0-9]+/g, "_") || "";

    if (normalized.includes("CAPTURE")) return "CAPTURED";
    if (normalized.includes("AUTHORIZE") || normalized.includes("AUTHORISED")) return "AUTHORIZED";
    if (normalized.includes("3DS") || normalized.includes("PENDING_AUTH")) return "PENDING_3DS";
    if (normalized.includes("FAIL") || normalized.includes("DECLINE") || normalized.includes("CANCEL") || normalized.includes("EXPIRE")) return "FAILED";

    return "PENDING";
}

// POST /api/webhooks/pokpay
// PokPay calls this URL when an SDK order/payment changes state.
export async function handlePokPayWebhook(payload: any) {


    const orderId = extractOrderId(payload);
    const gatewayStatus = extractGatewayStatus(payload);
    const status = mapGatewayStatus(gatewayStatus);

    if (!orderId) {
        return { success: false, error: "missing order id" };
    }

    const row = db.query(`SELECT id, status FROM orders WHERE pokpay_order_id = ?`).get(orderId) as any;

    if (!row) {
        return { success: false, error: "order not found" };
    }

    db.run(
        `UPDATE orders SET status = ?, raw_response = ? WHERE pokpay_order_id = ?`,
        [status, JSON.stringify({ source: "pokpay_webhook", gatewayStatus, payload }), orderId]
    );

    return { success: true, orderId, status };
}
