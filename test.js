// Test script for the chat API
const fetch = require('node-fetch');

async function testAPI() {
  try {
    // Test login
    console.log('Testing login...');
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);

    if (!loginResponse.ok) return;

    const token = loginData.token;

    // Test creating a user
    console.log('Testing user creation...');
    const userResponse = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify({
        username: 'testuser',
        full_name: 'Usuário Teste',
        password: 'test123',
        role: 'user'
      })
    });
    const userData = await userResponse.json();
    console.log('User creation response:', userData);

    // Test getting users
    console.log('Testing get users...');
    const usersResponse = await fetch('http://localhost:3000/api/users', {
      headers: { 'Authorization': token }
    });
    const usersData = await usersResponse.json();
    console.log('Users:', usersData);

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testAPI();