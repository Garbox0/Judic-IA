This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Security & CSP Maintenance 🛡️

This project implements a strict Content Security Policy (CSP) to achieve an A+ score.

### 🔐 Managing CSP Hashes
If you add new components that inject inline styles (like Next.js Image transparency or third-party widgets) and see CSP violations in the console:
1. Identify the hash in the browser console error (e.g., `sha256-abc...`).
2. Add the hash to the `style-src` directive in `middleware.js`.
3. **Important:** We use `'unsafe-hashes'` to allow these hashes to work within style attributes.

### 🔄 Extending Middleware
To add new external domains (e.g., Google Maps, Analytics):
- Update `script-src`, `style-src`, `img-src`, or `connect-src` in `middleware.js`.
- Always prefer `https://` for external resources to avoid **Mixed Content** downgrades.

### 🧼 Code Style Rules
- **No inline styles:** Avoid `style={{ ... }}` in JSX. Use CSS classes in `.css` files.
- **Nonce Usage:** For any manual `<script>` or `<style>` tags, pass the `nonce` available in the layout context.
