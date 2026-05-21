import { db } from "../db";
import { authenticate, captureSdkOrder } from "../pokpay";

// POST /api/orders/:orderId/capture
// Body: { amount: number, splitWith?: { merchantId: string, amount: number } }
export async function handleCaptureOrder(orderId: string, body: any) {
    const flow = "auth_capture";
    try {
        const accessToken = await authenticate();
        const result = await captureSdkOrder(accessToken, orderId, {
            amount: body.amount,
            splitWith: body.splitWith,
        });

        db.run(
            `UPDATE orders SET status = ?, raw_response = ? WHERE pokpay_order_id = ?`,
            ["CAPTURED", JSON.stringify({ source: "manual_capture", result }), orderId]
        );

        return { success: true, orderId, status: "CAPTURED", result };
    } catch (e: any) {
        throw e;
    }
}
