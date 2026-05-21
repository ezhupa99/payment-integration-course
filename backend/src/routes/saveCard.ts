import { db } from "../db";
import { authenticate, tokenizeCard } from "../pokpay";

// POST /api/cards
// Body: { userId: number, cardPayload: { csFlexCard: { jwe: string }, billingInfo: { ... }, securityCode: string } }
export async function handleSaveCard(body: any) {
    const { cardPayload } = body;
    try {
        const accessToken = await authenticate();
        const tokenizedCard = await tokenizeCard(accessToken, cardPayload);

        const last4 = tokenizedCard.hiddenNumber ? tokenizedCard.hiddenNumber.slice(-4) : null;
        const holderFirstName = tokenizedCard.holderFirstName ?? null;
        const holderLastName = tokenizedCard.holderLastName ?? null;

        db.run(
            `INSERT OR IGNORE INTO cards (user_id, pokpay_card_id, last4, holder_first_name, holder_last_name)
       VALUES (?, ?, ?, ?, ?)`,
            [body.userId, tokenizedCard.id, last4, holderFirstName, holderLastName]
        );

        return { success: true, cardId: tokenizedCard.id };
    } catch (e: any) {
        throw e;
    }
}
