import { serve } from "bun";
import { handleCreateOrder } from "./routes/createOrder";
import { handleCreateUser } from "./routes/createUser";
import { handleSaveCard } from "./routes/saveCard";
import { handlePrepareTokenPayment } from "./routes/payWithSaved";
import { handleConfirmOrder } from "./routes/confirmOrder";
import { handleCaptureOrder } from "./routes/captureOrder";
import { handlePokPayWebhook } from "./routes/pokpayWebhook";
import { db } from "./db";
import { join } from "path";

const PORT = parseInt(process.env.PORT || "4000");

serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url);

        // API to fetch cards for a user
        if (req.method === "GET" && url.pathname.startsWith("/api/cards/")) {
            const userId = url.pathname.split("/").pop() || "";
            const cards = db.query(`SELECT * FROM cards WHERE user_id = ?`).all(userId);
            return Response.json({ cards });
        }

        if (req.method === "POST" && url.pathname === "/api/users") {
            const body = await req.json();
            return Response.json(await handleCreateUser(body));
        }
        if (req.method === "POST" && url.pathname === "/api/orders") {
            const body = await req.json();
            return Response.json(await handleCreateOrder(body));
        }
        if (req.method === "POST" && url.pathname === "/api/cards") {
            const body = await req.json();
            return Response.json(await handleSaveCard(body));
        }
        if (req.method === "POST" && url.pathname === "/api/prepare-token-payment") {
            const body = await req.json();
            return Response.json(await handlePrepareTokenPayment(body));
        }
        if (req.method === "POST" && url.pathname === "/api/webhooks/pokpay") {
            const body = await req.json().catch(() => ({}));
            return Response.json(await handlePokPayWebhook(body));
        }
        // POST /api/orders/:orderId/confirm
        const confirmMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/confirm$/);
        if (req.method === "POST" && confirmMatch) {
            const body = await req.json().catch(() => ({}));
            return Response.json(await handleConfirmOrder(confirmMatch[1], body));
        }
        // POST /api/orders/:orderId/capture
        const captureMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/capture$/);
        if (req.method === "POST" && captureMatch) {
            const body = await req.json();
            return Response.json(await handleCaptureOrder(captureMatch[1], body));
        }

        // Serve static files for non-API routes
        if (!url.pathname.startsWith("/api")) {
            const filePath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
            const fullPath = join(import.meta.dir, "..", "..", "frontend", filePath);
            const file = Bun.file(fullPath);

            if (await file.exists()) {
                return new Response(file);
            }
        }

        return new Response("Not Found", { status: 404 });
    },
});
