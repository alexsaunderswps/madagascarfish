import createNextIntlPlugin from "next-intl/plugin";

// Points the plugin at the request-config module that resolves the
// active locale's messages. See `frontend/i18n/request.ts`.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withNextIntl(nextConfig);
