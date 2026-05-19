#!/bin/bash

# Configuration
URL="http://localhost:3000"
USERNAME="testuser"
PASSWORD="password123"

echo "--- 1. Signup ---"
curl -X POST "$URL/signup" -H "Content-Type: application/json" -d "{\"username\":\"$USERNAME\", \"password\":\"$PASSWORD\"}"
echo -e "\n"

echo "--- 2. Login ---"
LOGIN_RESPONSE=$(curl -s -X POST "$URL/login" -H "Content-Type: application/json" -d "{\"username\":\"$USERNAME\", \"password\":\"$PASSWORD\"}")
echo $LOGIN_RESPONSE
ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
REFRESH_TOKEN=$(echo $LOGIN_RESPONSE | sed -n 's/.*"refreshToken":"\([^"]*\)".*/\1/p')
echo -e "\nAccess Token: $ACCESS_TOKEN"
echo -e "Refresh Token: $REFRESH_TOKEN\n"

echo "--- 3. Access Protected Route (Success) ---"
curl -X GET "$URL/protected" -H "Authorization: Bearer $ACCESS_TOKEN"
echo -e "\n"

echo "--- 4. Wait for Token Expiry (16s) ---"
sleep 16

echo "--- 5. Access Protected Route (Should Fail - 403) ---"
curl -s -o /dev/null -w "%{http_code}" -X GET "$URL/protected" -H "Authorization: Bearer $ACCESS_TOKEN"
echo -e "\n"

echo "--- 6. Use Refresh Token to get New Access Token ---"
REFRESH_RESPONSE=$(curl -s -X POST "$URL/token" -H "Content-Type: application/json" -d "{\"token\":\"$REFRESH_TOKEN\"}")
echo $REFRESH_RESPONSE
NEW_ACCESS_TOKEN=$(echo $REFRESH_RESPONSE | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
echo -e "\nNew Access Token: $NEW_ACCESS_TOKEN\n"

echo "--- 7. Access Protected Route with New Token (Success) ---"
curl -X GET "$URL/protected" -H "Authorization: Bearer $NEW_ACCESS_TOKEN"
echo -e "\n"

echo "--- 8. Logout ---"
curl -X DELETE "$URL/logout" -H "Content-Type: application/json" -d "{\"token\":\"$REFRESH_TOKEN\"}"
echo -e "\nLogout complete."
