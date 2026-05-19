# Deployment Guide for JWT Auth API (Ubuntu 22.04)

This guide provides step-by-step instructions to set up and run the JWT Authentication API on a fresh Ubuntu 22.04 LTS instance.

## 1. System Update
First, ensure your system packages are up to date:
```bash
sudo apt update && sudo apt upgrade -y
```

## 2. Install Node.js and NPM
The application requires Node.js. We recommend using the LTS version (v20.x or higher).

```bash
# Install Node.js using NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node -v
npm -v
```

## 3. Clone and Prepare Application
Navigate to your application directory and install dependencies.

```bash
# Navigate to project folder
cd /path/to/your/jwt-auth

# Install Node.js dependencies
npm install
```

## 4. Environment Configuration
Ensure your `.env` file is configured with secure secrets.
```bash
# Create .env if it doesn't exist
cat <<EOF > .env
ACCESS_TOKEN_SECRET=$(openssl rand -base64 32)
REFRESH_TOKEN_SECRET=$(openssl rand -base64 32)
PORT=3000
EOF
```

## 5. Running the Application
### Option A: Direct Run (Development)
```bash
node server.js
```

### Option B: Using Process Manager (Production Recommended)
Use `pm2` to keep the application running in the background and restart it on failure.

```bash
sudo npm install -g pm2
pm2 start server.js --name "jwt-auth-api"
pm2 save
pm2 startup
```

## 6. Testing the Deployment
You can use the provided `test.sh` script to verify the installation:
```bash
chmod +x test.sh
./test.sh
```

---
*Note: This application currently uses an in-memory database. For production, consider integrating MongoDB or PostgreSQL.*
