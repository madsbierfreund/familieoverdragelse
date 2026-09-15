import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Ingen automatisk genererede AGENTS.md/CLAUDE.md i repoet.
  agentRules: false,
};

export default nextConfig;
