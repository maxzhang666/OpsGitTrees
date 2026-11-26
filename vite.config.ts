import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

export default defineConfig({
  plugins: [monkey({
    entry: 'src/main.ts',
    userscript: {
      name: 'OpsGitTrees',
      namespace: 'OpsGitTrees',
      version: '0.1.1',
      description: { '': 'Lightweight GitHub repository tree and path navigation', 'zh-CN': '轻量的 GitHub 仓库文件树与路径导航' },
      match: ['https://github.com/*'],
      connect: ['api.github.com'],
      noframes: true,
      'inject-into': 'content',
      sandbox: 'DOM',
      'run-at': 'document-idle',
    },
    build: { fileName: 'opsgittrees.user.js' },
    server: { open: false },
  })],
  build: { target: 'es2022', minify: false },
});
