#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Vorbis Player Deployment Script');
console.log('=====================================\n');

// Check if .env.example exists and .env.local doesn't
const envExamplePath = path.join(process.cwd(), '.env.example');
const envLocalPath = path.join(process.cwd(), '.env.local');

if (fs.existsSync(envExamplePath) && !fs.existsSync(envLocalPath)) {
  console.log('📋 Setting up environment variables...');
  console.log('   Please copy .env.example to .env.local and fill in your Spotify credentials');
  console.log('   Or use: cp .env.example .env.local\n');
}

// Check if Vercel CLI is installed
try {
  execSync('vercel --version', { stdio: 'ignore' });
  console.log('✅ Vercel CLI is installed');
} catch (error) {
  console.log('📦 Installing Vercel CLI...');
  execSync('npm install -g vercel', { stdio: 'inherit' });
  console.log('✅ Vercel CLI installed successfully');
}

console.log('\n🔨 Building the project...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build completed successfully');
} catch (error) {
  console.error('❌ Build failed');
  process.exit(1);
}

console.log('\n🚀 Deploying to Vercel...');
try {
  const isProduction = process.argv.includes('--prod');
  const command = isProduction ? 'vercel --prod' : 'vercel';
  
  execSync(command, { stdio: 'inherit' });
  console.log(`✅ Deployment ${isProduction ? 'to production' : 'preview'} completed successfully`);
  
  console.log('\n🎵 Next steps:');
  console.log('1. Update your Spotify app redirect URI with your Vercel URL');
  console.log('2. Make sure environment variables are set in Vercel dashboard');
  console.log('3. Test your deployment by connecting to Spotify');
  
} catch (error) {
  console.error('❌ Deployment failed');
  console.log('\n🔧 Troubleshooting tips:');
  console.log('1. Make sure you\'re logged in to Vercel: vercel login');
  console.log('2. Check that your environment variables are set');
  console.log('3. Verify your Spotify app configuration');
  process.exit(1);
}

console.log('\n🎉 Deployment complete! Your Vorbis Player is now live!');