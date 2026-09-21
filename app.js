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
    <input
      id="auth-email"
      type="email"
      placeholder="Your email address"
      autocomplete="email"
    >
    <button id="send-login-button">
      Sign in
    </button>
    <button id="pay-button">
      Pay ₦200
    </button>
    <p id="auth-message"></p>
  `;

  header.appendChild(authBox);

  document
    .getElementById('send-login-button')
    .addEventListener('click', sendLoginLink);

  document
    .getElementById('pay-button')
    .addEventListener('click', startPayment);
}

async function sendLoginLink() {
  const email = getEmail();
  const message = document.getElementById('auth-message');

  if (!email) {
    message.textContent = 'Enter a valid email address.';
    return;
  }

  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin
    }
  });

  if (error) {
    console.error(error);
    message.textContent = error.message;
    return;
  }

  message.textContent =
    'Check your email and click the sign-in link.';
}

async function startPayment() {
  const email = getEmail();
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

function getEmail() {
  const input = document.getElementById('auth-email');

  if (!input) {
    return '';
  }

  const email = input.value.trim().toLowerCase();

  if (!email || !email.includes('@')) {
    return '';
  }

  return email;
}
