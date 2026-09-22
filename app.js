const SUPABASE_URL =
  'https://ijapytnwikzovdhsgcnh.supabase.co';

const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqYXB5dG53aWt6b3ZkaHNnY25oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NzU2ODAsImV4cCI6MjEwNTM1MTY4MH0.O51p37THBEDrYZym7nF2x4TWM974uM66o4H55qGL0RE';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const FUNCTION_BASE = '/api';

let unlocked = false;

document.addEventListener('DOMContentLoaded', async () => {
  addAuthenticationUI();
  await restoreSession();
});

function addAuthenticationUI() {
  const header = document.querySelector('.top');

  if (!header) {
    return;
  }

  const authBox = document.createElement('div');
  authBox.id = 'auth-box';
  authBox.innerHTML = `
    <div id="login-section">
      <input
        id="login-email"
        type="email"
        placeholder="Email"
        autocomplete="email"
      >
      <input
        id="login-password"
        type="password"
        placeholder="Password"
        autocomplete="current-password"
      >
      <button id="login-button">
        Log in
      </button>
    </div>
    <p id="auth-message"></p>
    <div id="pay-section">
      <input
        id="pay-email"
        type="email"
        placeholder="Email for payment"
        autocomplete="email"
      >
      <button id="pay-button">
        Pay ₦200
      </button>
    </div>
  `;

  header.appendChild(authBox);

  document
    .getElementById('login-button')
    .addEventListener('click', loginWithPassword);

  document
    .getElementById('pay-button')
    .addEventListener('click', startPayment);
}

async function loginWithPassword() {
  const email = getEmail('login-email');
  const password = document.getElementById('login-password').value;
  const message = document.getElementById('auth-message');

  if (!email) {
    message.textContent = 'Enter a valid email address.';
    return;
  }

  if (!password) {
    message.textContent = 'Enter your password.';
    return;
  }

  message.textContent = 'Logging in...';

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error(error);
    message.textContent = error.message;
    return;
  }

  message.textContent = '';
}

async function startPayment() {
  const email = getEmail('pay-email');
  const message = document.getElementById('auth-message');

  if (!email) {
    message.textContent =
      'Enter the email address you will use for payment.';
    return;
  }

  message.textContent = 'Opening Paystack...';

  try {
    const response = await fetch(
      `${FUNCTION_BASE}/initialize-payment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Unable to start payment.');
    }

    window.location.href = result.authorization_url;
  } catch (error) {
    console.error(error);
    message.textContent = error.message;
  }
}

async function restoreSession() {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (session) {
    await checkAccess(session.access_token);
  }

  supabaseClient.auth.onAuthStateChange(
    async (_event, updatedSession) => {
      if (updatedSession) {
        await checkAccess(updatedSession.access_token);
      }
    }
  );
}

async function checkAccess(accessToken) {
  try {
    const response = await fetch(
      `${FUNCTION_BASE}/check-access`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const result = await response.json();

    if (response.ok && result.paid) {
      unlocked = true;
      window.dispatchEvent(new CustomEvent('paid-access-granted'));
    }
  } catch (error) {
    console.error('Access check failed:', error);
  }
}

function getEmail(inputId) {
  const input = document.getElementById(inputId);

  if (!input) {
    return '';
  }

  const email = input.value.trim().toLowerCase();

  if (!email || !email.includes('@')) {
    return '';
  }

  return email;
}

window.addEventListener(
  'paid-access-granted',
  () => {
    if (typeof renderChapterRail === 'function') {
      renderChapterRail();
    }

    if (typeof renderAll === 'function') {
      renderAll();
    }
  }
);

document.addEventListener('click', event => {
  if (event.target.id !== 'paywall-pay-button') {
    return;
  }

  const payEmail = document.getElementById('pay-email');
  const payButton = document.getElementById('pay-button');

  if (payEmail && !payEmail.value) {
    payEmail.focus();
    return;
  }

  if (payButton) {
    payButton.click();
  }
});
