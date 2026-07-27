module.exports = {
  apps: [{
    name: 'vitahub-api',
    cwd: '../../apps/api',
    script: 'dist/main.js',
    instances: 2,
    exec_mode: 'cluster',
    env: { NODE_ENV: 'production' },
  }],
};
