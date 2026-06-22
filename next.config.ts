import type { NextConfig } from "next";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const githubPagesBasePath =
  process.env.GITHUB_PAGES === "true" && repositoryName && !repositoryName.endsWith(".github.io")
    ? `/${repositoryName}`
    : "";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  basePath: githubPagesBasePath || undefined,
  assetPrefix: githubPagesBasePath ? `${githubPagesBasePath}/` : undefined,
  env: {
    NEXT_PUBLIC_BASE_PATH: githubPagesBasePath
  },
  output: "export",
  images: {
    unoptimized: true
  },
  trailingSlash: true
};

export default nextConfig;
