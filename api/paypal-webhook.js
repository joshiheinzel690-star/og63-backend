```js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    if (!clientId || !clientSecret || !webhookId) {
      return res.status(500).json({
        error: "PayPal environment variables are not configured."
      });
    }

    const auth = Buffer.from(
      clientId + ":" + clientSecret
    ).toString("base64");

    const tokenResponse = await fetch(
      "https://api-m.sandbox.paypal.com/v1/oauth2/token",
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + auth,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "grant_type=client_credentials"
      }
    );

    if (!tokenResponse.ok) {
      return res.status(502).json({
        error: "Could not authenticate with PayPal."
      });
    }

    const tokenData = await tokenResponse.json();

    const verificationResponse = await fetch(
      "https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + tokenData.access_token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          auth_algo: req.headers["paypal-auth-algo"],
          cert_url: req.headers["paypal-cert-url"],
          transmission_id: req.headers["paypal-transmission-id"],
          transmission_sig: req.headers["paypal-transmission-sig"],
          transmission_time: req.headers["paypal-transmission-time"],
          webhook_id: webhookId,
          webhook_event: req.body
        })
      }
    );

    if (!verificationResponse.ok) {
      return res.status(400).json({
        error: "PayPal webhook verification request failed."
      });
    }

    const verification = await verificationResponse.json();

    if (verification.verification_status !== "SUCCESS") {
      return res.status(401).json({
        error: "Invalid PayPal webhook signature."
      });
    }

    return res.status(200).json({
      received: true,
      verified: true,
      event: req.body && req.body.event_type
        ? req.body.event_type
        : null
    });
  } catch (error) {
    console.error("PayPal webhook error:", error);

    return res.status(500).json({
      error: "Internal server error."
    });
  }
}
```
