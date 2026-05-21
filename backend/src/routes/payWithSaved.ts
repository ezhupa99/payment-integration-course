import { db } from "../db";
import { authenticate, setup3DS } from "../pokpay";

// POST /api/prepare-token-payment
// Body: { cardId: string, orderId: string, userId: number }
export async function handlePrepareTokenPayment(body: any) {
    try {
        const accessToken = await authenticate();
        const threeDSResult = await setup3DS(accessToken, body.cardId, body.orderId);

        db.run(
            `UPDATE orders SET status = ?, raw_response = ? WHERE pokpay_order_id = ?`,
            ["PENDING_3DS", JSON.stringify(threeDSResult), body.orderId]
        );



        return threeDSResult.payerAuthentication;
    } catch (e: any) {
        throw e;
    }
}
