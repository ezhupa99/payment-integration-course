import { db } from "../db";
import { authenticate, getSdkOrder } from "../pokpay";

type LocalOrderStatus = "PENDING" | "PENDING_3DS" | "AUTHORIZED" | "CAPTURED" | "FAILED";

const FAILED_STATUSES = new Set(["FAILED", "FAILURE", "DECLINED", "CANCELLED", "CANCELED", "ERROR"]);
const CAPTURED_STATUSES = new Set(["CAPTURED", "PAID", "PAYMENT_CAPTURED"]);
const AUTHORIZED_STATUSES = new Set(["AUTHORIZED", "AUTHORISED", "PAYMENT_AUTHORIZED", "PAYMENT_AUTHORISED"]);
const PENDING_3DS_STATUSES = new Set(["PENDING_3DS", "REQUIRES_3DS", "REQUIRES_ACTION", "AUTHENTICATION_PENDING"]);
const PENDING_STATUSES = new Set(["PENDING", "PROCESSING", "CREATED"]);

function collectStatusValues(value: unknown, statuses = new Set<string>()): Set<string> {
    if (!value || typeof value !== "object") return statuses;

    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        if (typeof nestedValue === "string" && /status|state/i.test(key)) {
            statuses.add(nestedValue.toUpperCase().replace(/[\s-]+/g, "_"));
        } else if (nestedValue && typeof nestedValue === "object") {
            collectStatusValues(nestedValue, statuses);
        }
    }

    return statuses;
}

function mapGatewayStatus(order: unknown): LocalOrderStatus | null {
    const statuses = collectStatusValues(order);

    if ([...statuses].some((status) => FAILED_STATUSES.has(status))) return "FAILED";
    if ([...statuses].some((status) => CAPTURED_STATUSES.has(status))) return "CAPTURED";
    if ([...statuses].some((status) => AUTHORIZED_STATUSES.has(status))) return "AUTHORIZED";
    if ([...statuses].some((status) => PENDING_3DS_STATUSES.has(status))) return "PENDING_3DS";
    if ([...statuses].some((status) => PENDING_STATUSES.has(status))) return "PENDING";

    return null;
}

// POST /api/orders/:orderId/confirm
// Body: { flow?: string, targetStatus?: "CAPTURED" | "AUTHORIZED", callbackResult?: any }
export async function handleConfirmOrder(orderId: string, body: any) {
    const flow = body?.flow || "unknown";
    const row = db.query(`SELECT id, status FROM orders WHERE pokpay_order_id = ?`).get(orderId) as any;

    if (!row) {
        return { success: false, error: "order not found" };
    }

    try {
        const accessToken = await authenticate();
        const gatewayOrder = await getSdkOrder(accessToken, orderId);
        const mappedStatus = mapGatewayStatus(gatewayOrder);

        if (!mappedStatus) {
            return {
                success: false,
                verificationPending: true,
                orderId,
                status: row.status,
                message: "Payment callback received, but backend verification could not map the final gateway status yet.",
            };
        }

        db.run(
            `UPDATE orders SET status = ?, raw_response = ? WHERE pokpay_order_id = ?`,
            [mappedStatus, JSON.stringify({ source: "gateway_order_lookup", flow, callbackResult: body?.callbackResult, gatewayOrder }), orderId]
        );

        return { success: true, orderId, status: mappedStatus };
    } catch (e: any) {
        return {
            success: false,
            verificationPending: true,
            orderId,
            status: row.status,
            message: "Payment callback received, but backend verification failed. Check again or wait for webhook/status update.",
            error: e.message,
        };
    }
}
