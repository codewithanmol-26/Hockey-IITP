# Sign-up e-mail setup (Resend + your domain)

Players get a 6 digit code by e-mail the first time they sign up. This is a one-time setup, about 15 minutes plus waiting for DNS.
Replace `yourdomain.com` with your real domain everywhere below.

## 0. Run the database update (once)

In Supabase > **SQL Editor**, run the file `supabase/migrations/20261024000000_fix_email_otps.sql` (and `20261023000001_sessions_date_text.sql` if you have not already). Without it the sign-up code cannot be saved.

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

| Name             | Value                                                           |
| ---------------- | --------------------------------------------------------------- |
| `RESEND_API_KEY` | the key from step 3                                             |
| `RESEND_FROM`    | `IITP Hockey <hockey@mail.yourdomain.com>`                      |
| `CRON_SECRET`    | any long random text (for the playing day reminders, see below) |

Then **Deployments** > the latest one > **Redeploy**.

### Who may sign up

Sign-up e-mails can be from any domain (Gmail, institute, etc.). This is the default, so you do not need to set anything. If the captain saved a player's e-mail, the code goes to that address. Otherwise the player types their own e-mail. To restrict sign-ups to one domain, add `SIGNUP_EMAIL_DOMAIN` with that domain (e.g. `iitp.ac.in`).

### Playing day reminders

`vercel.json` runs two small jobs every day: at 7 pm it reminds everyone about tomorrow's morning session, and at 7 am it reminds everyone about today's evening session. They need `CRON_SECRET` to be set (any long random text). The jobs run in Vercel > your project > **Settings** > **Cron Jobs**, where you can also press **Run** to test one.

## 5. Test it

Open the app as captain > menu (⋮) > **Test the sign-up e-mail**. Enter a Gmail (or any address that is not on your domain) and check inbox and spam.

- "Sent from: IITP Hockey <hockey@mail.yourdomain.com>" and the mail arrives: done.
- "E-mail is limited until a domain is verified": the domain is not Verified in Resend yet, or `RESEND_FROM` is not on that domain.
- "The e-mail key on the server is wrong": re-copy `RESEND_API_KEY` and redeploy.

## Using the domain for the app address too (optional)

Vercel > Settings > **Domains** > add e.g. `hockey.yourdomain.com` and create the DNS record Vercel shows. Nothing in the code needs changing. Players should open the app from the new address and install it again.
