const output = document.getElementById("output");

function log(data) {
    output.textContent = JSON.stringify(data, null, 2);
}

// Structured wide-event log to console. Pair fields like flow/step/orderId/userId/cardId/status/error.
function logEvent(fields) {
    console.log(JSON.stringify({ ts: new Date().toISOString(), source: "frontend", ...fields }));
}

// Confirm an order on the backend (browser-callback signal — non-authoritative).
async function confirmOrder(orderId, flow, callbackResult, targetStatus) {
    try {
        const res = await fetch(`/api/orders/${orderId}/confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ flow, callbackResult, targetStatus })
        });
        const data = await res.json();
        logEvent({ flow, step: "confirm_order_response", orderId, ...data });
        return data;
    } catch (e) {
        logEvent({ flow, step: "confirm_order_response", orderId, error: e.message });
    }
}

function showPendingVerification(orderId, data) {
    log({
        status: "Payment pending confirmation",
        orderId,
        message: data?.message || "Payment result received. We could not verify the final status yet, so this order is pending confirmation.",
        currentStatus: data?.status
    });
}

// Shared wizard state
let currentUserId = null;
let currentUserName = null;
let savedCardId = null;

function unlock(stepId, statusId, userMessage) {
    document.getElementById(stepId).classList.remove("locked");
    const status = document.getElementById(statusId);
    status.textContent = "Active";
    status.className = "step-status status-active";
    if (userMessage) {
        const info = document.getElementById(stepId.replace("step-", "step") + "-info") ||
                     document.querySelector(`#${stepId} .context-info`);
        if (info) {
            info.textContent = userMessage;
            info.style.display = "block";
        }
    }
}

function markDone(stepId, statusId) {
    const status = document.getElementById(statusId);
    status.textContent = "Done ✓";
    status.className = "step-status status-done";
}

// ─── Step 1: Create User ────────────────────────────────────────────────────

document.getElementById("create-user-btn").addEventListener("click", async () => {
    const name = document.getElementById("user-name").value.trim();
    if (!name) return alert("Enter a name first");

    try {
        log("Creating user...");
        const res = await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name })
        });
        const data = await res.json();

        if (!data.success) { log(data); return; }

        currentUserId = data.userId;
        currentUserName = data.name;

        const userInfo = document.getElementById("user-info");
        userInfo.textContent = `User created: ${currentUserName} (ID: ${currentUserId})`;
        userInfo.style.display = "block";

        markDone("step-1", "status-1");

        // Unlock Step 2 and show context
        document.getElementById("step-2").classList.remove("locked");
        const s2status = document.getElementById("status-2");
        s2status.textContent = "Active";
        s2status.className = "step-status status-active";
        const s2info = document.getElementById("step2-user-info");
        s2info.textContent = `Saving card for: ${currentUserName} (User ID: ${currentUserId})`;
        s2info.style.display = "block";

        log({ step: "User created", userId: currentUserId, name: currentUserName });
        logEvent({ flow: "user", step: "user_created", userId: currentUserId, name: currentUserName });
    } catch (e) {
        log({ error: e.message });
        logEvent({ flow: "user", step: "user_created", error: e.message });
    }
});

// ─── Step 2: Save Card ──────────────────────────────────────────────────────

document.getElementById("start-save-card-btn").addEventListener("click", () => {
    if (!document.getElementById("save-card-consent").checked) {
        log({ message: "Please confirm that the customer wants to save this card for future payments." });
        return;
    }

    PokPayment.renderAddCardForm(
        "pok-add-card",
        "Save Card",
        async function onSuccess(cardPayload) {
            log({ step: "Card tokenized by provider component" });
            logEvent({ flow: "save_card", step: "cdn_tokenized", userId: currentUserId });

            try {
                const res = await fetch("/api/cards", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: currentUserId, cardPayload })
                });
                const data = await res.json();

                if (!data.success) { log(data); return; }

                savedCardId = data.cardId;
                markDone("step-2", "status-2");

                // Unlock Step 3 and show context
                document.getElementById("step-3").classList.remove("locked");
                const s3status = document.getElementById("status-3");
                s3status.textContent = "Active";
                s3status.className = "step-status status-active";
                const s3info = document.getElementById("step3-card-info");
                s3info.textContent = `Paying with card token: ${savedCardId} (User: ${currentUserName})`;
                s3info.style.display = "block";

                // Also unlock Step 4 (auth + delayed capture)
                document.getElementById("step-4").classList.remove("locked");
                const s4status = document.getElementById("status-4");
                s4status.textContent = "Active";
                s4status.className = "step-status status-active";
                const s4info = document.getElementById("step4-card-info");
                s4info.textContent = `Authorizing with card token: ${savedCardId} (User: ${currentUserName})`;
                s4info.style.display = "block";

                log({ step: "Card saved to DB", cardId: savedCardId });
                logEvent({ flow: "save_card", step: "card_persisted", userId: currentUserId, cardId: savedCardId });
            } catch (e) {
                log({ error: e.message });
                logEvent({ flow: "save_card", step: "card_persisted", userId: currentUserId, error: e.message });
            }
        },
        function onError(error) {
            log({ status: "Save card failed", error });
            logEvent({ flow: "save_card", step: "cdn_tokenized", userId: currentUserId, error: typeof error === "string" ? error : JSON.stringify(error) });
        },
        { env: "staging", locale: "en" }
    );
});

// ─── Step 3: Pay with Saved Card ────────────────────────────────────────────

document.getElementById("pay-saved-btn").addEventListener("click", async () => {
    const amount = parseInt(document.getElementById("ps-amount").value);

    try {
        // Create a Pok SDK Order for this payment
        log("Creating Pok SDK order...");
        let res = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: currentUserId, amount })
        });
        let data = await res.json();
        if (!data.success) { log(data); return; }
        const orderId = data.orderId;

        // Setup 3DS for the saved card token against this order
        log("Setting up 3DS for saved card...");
        res = await fetch("/api/prepare-token-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cardId: savedCardId, orderId, userId: currentUserId })
        });
        const payerAuth = await res.json();

        log({ step: "3DS setup complete", orderId });

        // Trigger the Pok CDN 3DS flow
        PokPayment.setUpCardTokenPayment({
            containerId: "pay-by-token",
            orderId: orderId,
            payerAuthentication: payerAuth,
            onSuccess: async function (result) {
                log({ status: "Payment result received", orderId });
                logEvent({ flow: "pay_with_saved", step: "cdn_success", userId: currentUserId, orderId, cardId: savedCardId, result });
                const confirmation = await confirmOrder(orderId, "pay_with_saved", result);
                if (confirmation?.success) {
                    markDone("step-3", "status-3");
                    log({ status: "Payment verified", orderId, paymentStatus: confirmation.status });
                } else if (confirmation?.verificationPending) {
                    showPendingVerification(orderId, confirmation);
                }
            },
            onError: function (error) {
                log({ status: "Payment failed", error });
                logEvent({ flow: "pay_with_saved", step: "cdn_error", userId: currentUserId, orderId, cardId: savedCardId, error: typeof error === "string" ? error : JSON.stringify(error) });
            },
            env: "staging"
        });
    } catch (e) {
        log({ error: e.message });
        logEvent({ flow: "pay_with_saved", step: "exception", userId: currentUserId, error: e.message });
    }
});

// ─── Step 4: Authorize Now, Capture Later ───────────────────────────────────

let authOrderId = null;

document.getElementById("authorize-btn").addEventListener("click", async () => {
    const amount = parseInt(document.getElementById("ac-amount").value);

    try {
        log("Creating Pok SDK order with autoCapture=false...");
        let res = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: currentUserId, amount, autoCapture: false, flow: "auth_capture" })
        });
        let data = await res.json();
        if (!data.success) { log(data); return; }
        authOrderId = data.orderId;
        logEvent({ flow: "auth_capture", step: "order_created", userId: currentUserId, orderId: authOrderId, amount });

        log("Setting up 3DS for saved card (auth-only)...");
        res = await fetch("/api/prepare-token-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cardId: savedCardId, orderId: authOrderId, userId: currentUserId })
        });
        const payerAuth = await res.json();
        log({ step: "3DS setup complete", orderId: authOrderId });

        PokPayment.setUpCardTokenPayment({
            containerId: "auth-3ds-container",
            orderId: authOrderId,
            payerAuthentication: payerAuth,
            onSuccess: async function (result) {
                log({ status: "Authorization result received", orderId: authOrderId });
                logEvent({ flow: "auth_capture", step: "cdn_success", userId: currentUserId, orderId: authOrderId, cardId: savedCardId, result });
                const confirmation = await confirmOrder(authOrderId, "auth_capture", result, "AUTHORIZED");
                if (confirmation?.success) {
                    document.getElementById("capture-btn").disabled = false;
                    log({ status: "Authorization verified", orderId: authOrderId, paymentStatus: confirmation.status });
                } else if (confirmation?.verificationPending) {
                    showPendingVerification(authOrderId, confirmation);
                }
            },
            onError: function (error) {
                log({ status: "Authorization failed", error });
                logEvent({ flow: "auth_capture", step: "cdn_error", userId: currentUserId, orderId: authOrderId, cardId: savedCardId, error: typeof error === "string" ? error : JSON.stringify(error) });
            },
            env: "staging"
        });
    } catch (e) {
        log({ error: e.message });
        logEvent({ flow: "auth_capture", step: "exception", userId: currentUserId, error: e.message });
    }
});

document.getElementById("capture-btn").addEventListener("click", async () => {
    if (!authOrderId) { log({ error: "no authorized order to capture" }); return; }

    const amount = parseInt(document.getElementById("ac-capture-amount").value);
    const splitMerchant = document.getElementById("ac-split-merchant").value.trim();
    const splitAmountRaw = document.getElementById("ac-split-amount").value;
    const body = { amount };
    if (splitMerchant && splitAmountRaw) {
        body.splitWith = { merchantId: splitMerchant, amount: parseInt(splitAmountRaw) };
    }

    try {
        log({ step: "Capturing order...", orderId: authOrderId, body });
        const res = await fetch(`/api/orders/${authOrderId}/capture`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        log({ status: data.success ? "Capture complete" : "Capture failed", orderId: authOrderId, paymentStatus: data.status });
        logEvent({ flow: "auth_capture", step: "capture_response", orderId: authOrderId, ...data });
        if (data.success) markDone("step-4", "status-4");
    } catch (e) {
        log({ error: e.message });
        logEvent({ flow: "auth_capture", step: "capture_exception", orderId: authOrderId, error: e.message });
    }
});

// ─── Guest Checkout (separate flow) ─────────────────────────────────────────

document.getElementById("start-checkout-btn").addEventListener("click", async () => {
    const amount = parseInt(document.getElementById("co-amount").value);

    try {
        log("Creating Pok SDK order for guest checkout...");
        const res = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: null, amount })
        });
        const data = await res.json();

        if (!data.success) { log(data); return; }

        const orderId = data.orderId;
        log({ step: "Order created", orderId });
        logEvent({ flow: "guest_checkout", step: "order_created", orderId, amount });

        PokPayment.renderForm(
            "pok-checkout",
            orderId,
            async function onSuccess(result) {
                log({ status: "Guest checkout result received", orderId });
                logEvent({ flow: "guest_checkout", step: "cdn_success", orderId, result });
                const confirmation = await confirmOrder(orderId, "guest_checkout", result);
                if (confirmation?.success) {
                    log({ status: "Guest checkout verified", orderId, paymentStatus: confirmation.status });
                } else if (confirmation?.verificationPending) {
                    showPendingVerification(orderId, confirmation);
                }
            },
            function onError(error) {
                log({ status: "Guest checkout failed", error });
                logEvent({ flow: "guest_checkout", step: "cdn_error", orderId, error: typeof error === "string" ? error : JSON.stringify(error) });
            },
            {
                env: "staging",
                locale: "en",
                initialState: { email: "test@example.com" }
            }
        );
    } catch (e) {
        log({ error: e.message });
        logEvent({ flow: "guest_checkout", step: "exception", error: e.message });
    }
});
