# Tranquil, Inc. website

Licensed private home care site for Tranquil, Inc. of Kennesaw, Georgia. The pages follow the company brochure. The forms follow the nursing assessments, the CCSP supervisory note, and the employment packet.

## Run it

```bash
node server.mjs
```

Then open http://127.0.0.1:8787

Node.js 20 or newer is required. There are no packages to install.

## Where submissions go

Every form is encrypted in the browser before it is sent. The server cannot read the answers. Two copies are possible:

1. An encrypted file in `secrets/inbox`. This always happens.
2. An email to the intake mailbox, with the same encrypted file attached, once mail is configured.

The email subject is only the form name and a reference number. It does not include a client’s name.

Open a record from **Forms → Open a secure submission**. Choose `secrets/tranquil-private.pem`, then open the inbox or the email attachment. The key is used only in that browser tab. It is not uploaded.

If the private key is lost, submissions already received cannot be opened. Keep a backup somewhere safe that is not the website and not an email attachment.

## Change the mailbox

The brochure address `tranquil2754@hotmail.com` is the default. To use a different mailbox, copy `config.example.env` to `secrets/config.env` and set `INTAKE_EMAIL`.

To actually send the email, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS` in that same file. For the Hotmail mailbox that is usually:

```
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=tranquil2754@hotmail.com
SMTP_PASS=an app password from Microsoft
```

Until those lines are filled in, nothing is lost: the encrypted file is still in `secrets/inbox`.

Clinical forms also ask for the staff code in `secrets/staff-access-code.txt`. Share that code with nurses through a private channel. The code does not decrypt records. Only the private key does.

## Hosting

The site is a single Node server, so it can move later without a rewrite.

- On this computer, `node server.mjs` is enough. It listens only on this machine.
- A shareable preview is published with GitHub Pages at https://ifemuyiwaojo.github.io/tranquil/ . That copy is for showing the site. It does not keep form submissions, and the private key is not on it.
- For a public site that also receives forms, a small virtual server is enough and usually costs a few dollars a month. Set `HOST=0.0.0.0` in `secrets/config.env`, run `node server.mjs`, and put Caddy or Cloudflare in front of it for HTTPS.
- Do not point the forms at a third-party form service. That would send health information to a company that is not your host.

Do not add analytics, chat widgets, or embedded fonts from another company. The site is deliberately free of those.

## HIPAA, plainly

Encryption before the message leaves the browser means the email provider cannot read the form. That is the right shape for a small agency that wants to avoid extra vendors.

It is not the whole HIPAA program. Before real client information is collected on the public internet, Tranquil still needs a current Notice of Privacy Practices review, staff training, a risk analysis, and a hosting arrangement whose provider will sign a business associate agreement if that provider can see protected health information. Consumer Hotmail is not that arrangement. Keep using the encrypted inbox, and move the mailbox to a service that will sign an agreement when the volume justifies it.

Do not turn the encryption off.

## Rebuild the pages

Page text lives in `src/pages`. After an edit:

```bash
node tools/build-pages.mjs
```

## Check the encryption

```bash
node tools/roundtrip.mjs
```
