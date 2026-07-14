import { defineConfig } from 'blume'

export default defineConfig({
  title: 'edge-language-tools',
  description: 'Type safety and editor tooling for EdgeJS templates.',
  github: {
    owner: 'eduwass',
    repo: 'edge-language-tools',
    branch: 'main',
  },
  redirects: [
    { from: '/story', to: '/edge-language-tools/other/story', status: 301 },
    { from: '/roadmap', to: '/edge-language-tools/other/roadmap', status: 301 },
  ],
  deployment: {
    site: 'https://eduwass.github.io/edge-language-tools',
    base: '/edge-language-tools',
  },
})
