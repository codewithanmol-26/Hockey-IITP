# Sign-up e-mail setup (Resend + your domain)

Players get a 6 digit code by e-mail the first time they sign up. This is a one-time setup, about 15 minutes plus waiting for DNS.
Replace `yourdomain.com` with your real domain everywhere below.

## 1. Add your domain in Resend
1. Log in at https://resend.com, open **Domains**, press **Add Domain**.
2. Type a **sub-domain** for sending, e.g. `mail.yourdomain.com` (a sub-domain keeps your normal e-mail on the main domain untouched). Pick the region closest to your players.
3. Resend now shows a few DNS records (an **MX** and a **TXT/SPF** record for sending, and a **TXT/DKIM** record). Copy them exactly as shown.

## 2. Put those records in your DNS
Open the place where you manage the domain (where you bought it, or Cloudflare etc.) > DNS, and add every record Resend lists: same type, same name, same value.
Back in Resend press **Verify**. It can take a few minutes, sometimes a few hours. Wait until the domain says **Verified**.

## 3. Make an API key
Resend > **API Keys** > **Create API Key** > permission **Sending access** (limit it to your domain if offered). Copy the key now, it is shown once.

## 4. Add three settings in Vercel
Vercel > your project > **Settings** > **Environment Variables** (tick Production, Preview and Development), then add:

| Name | Value |
| --- | --- |
| `RESEND_API_KEY` | the key from step 3 |
| `RESEND_FROM` | `Inter IIT Hockey <hockey@mail.yourdomain.com>` |
| `SIGNUP_EMAIL_DOMAIN` | optional, see below |

Then **Deployments** > the latest one > **Redeploy**.

### What to put in `SIGNUP_EMAIL_DOMAIN`
- If you saved each player's e-mail in the app (Add student / Import), the code is sent to **that** address and nobody can claim someone else's account. Leave `SIGNUP_EMAIL_DOMAIN` empty.
- If players type their own e-mail at sign-up, set it to your institute's domain (for example `iitp.ac.in`) so only institute addresses are accepted. Without it, anyone who knows a roll number could sign up as that player with any e-mail.

## 5. Test it
Open the app as captain > menu (⋮) > **Test the sign-up e-mail**. Enter a Gmail (or any address that is not on your domain) and check inbox and spam.
- "Sent from: Inter IIT Hockey <hockey@mail.yourdomain.com>" and the mail arrives: done.
- "E-mail is limited until a domain is verified": the domain is not Verified in Resend yet, or `RESEND_FROM` is not on that domain.
- "The e-mail key on the server is wrong": re-copy `RESEND_API_KEY` and redeploy.

## Using the domain for the app address too (optional)
Vercel > Settings > **Domains** > add e.g. `hockey.yourdomain.com` and create the DNS record Vercel shows. Nothing in the code needs changing. Players should open the app from the new address and install it again.
