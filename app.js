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
let claimEmail = '';

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

      <button id="login-button" type="button">
        Log in
      </button>
    </div>

    <div id="claim-section">
      <p>
        Already paid? Set up your login without paying again.
      </p>

      <input
        id="claim-email"
        type="email"
        placeholder="Email used for payment"
        autocomplete="email"
      >

      <button id="claim-link-button" type="button">
        Email me a login link
      </button>

      <div id="claim-password-section" hidden>
        <input
          id="claim-password"
          type="password"
          placeholder="Create a password"
          autocomplete="new-password"
        >

        <input
          id="claim-password-confirm"
          type="password"
          placeholder="Confirm password"
          autocomplete="new-password"
        >

        <button id="claim-password-button" type="button">
          Set password and unlock
        </button>
      </div>
    </div>

    <p id="auth-message"></p>

    <div id="pay-section">
      <input
        id="pay-email"
        type="email"
        placeholder="Email for payment"
        autocomplete="email"
      >

      <button id="pay-button" type="button">
        Pay ₦200
      </button>
    </div>
  `;

  header.appendChild(authBox);

  document
    .getElementById('login-button')
    .addEventListener('click', loginWithPassword);

  document
    .getElementById('claim-link-button')
    .addEventListener('click', sendLegacyLoginLink);

  document
    .getElementById('claim-password-button')
    .addEventListener('click', setLegacyPassword);

  document
    .getElementById('pay-button')
    .addEventListener('click', startPayment);
}

async function loginWithPassword() {
  const email = getEmail('login-email');
  const password =
    document.getElementById('login-password').value;
  const message = document.getElementById('auth-message');

  if (!email) {
    message.textContent = 'Enter a valid email address.';
    return;
  }

  if (!password) {
    message.textContent = 'Enter your password.';
    return;
  }

  setButtonDisabled('login-button', true);
  message.textContent = 'Logging in...';

  try {
    const { error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      throw error;
    }

    message.textContent = 'Logged in successfully.';
  } catch (error) {
    console.error(error);
    message.textContent =
      error.message || 'Unable to log in.';
  } finally {
    setButtonDisabled('login-button', false);
  }
}

async function sendLegacyLoginLink() {
  const email = getEmail('claim-email');
  const message = document.getElementById('auth-message');
  const button = document.getElementById('claim-link-button');

  if (!email) {
    message.textContent = 'Enter the email used for payment.';
    return;
  }

  claimEmail = email;
  button.disabled = true;
  message.textContent = 'Sending your login link...';

  try {
    const { error } =
      await supabaseClient.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: window.location.origin
        }
      });

    if (error) {
      throw error;
    }

    message.textContent =
      'If this email belongs to a previous purchase, ' +
      'we have sent a login link. Check your inbox.';
  } catch (error) {
    console.error(error);
    message.textContent =
      error.message || 'Unable to send the login link.';
  } finally {
    button.disabled = false;
  }
}

async function setLegacyPassword() {
  const password =
    document.getElementById('claim-password').value;
  const confirmPassword =
    document.getElementById('claim-password-confirm').value;
  const message = document.getElementById('auth-message');
  const button = document.getElementById('claim-password-button');

  if (!password || password.length < 6) {
    message.textContent =
      'Password must be at least 6 characters.';
    return;
  }

  if (password !== confirmPassword) {
    message.textContent = 'Passwords do not match.';
    return;
  }

  button.disabled = true;
  message.textContent = 'Setting your password...';

  try {
    const {
      data: { session }
    } = await supabaseClient.auth.getSession();

    if (!session) {
      throw new Error(
        'Open the login link from your email before setting a password.'
      );
    }

    const { error } =
      await supabaseClient.auth.updateUser({
        password
      });

    if (error) {
      throw error;
    }

    const profileResponse = await fetch(
      `${FUNCTION_BASE}/save-profile`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({})
      }
    );

    if (!profileResponse.ok) {
      const result = await profileResponse.json();
      throw new Error(
        result.error || 'Unable to save your profile.'
      );
    }

    await checkAccess(session.access_token);

    if (!unlocked) {
      message.textContent =
        'Your account is ready, but no successful payment ' +
        'was found for this email address.';
      return;
    }

    message.textContent =
      'Password created. Your paid access is now unlocked.';
  } catch (error) {
    console.error(error);
    message.textContent =
      error.message || 'Unable to set your password.';
  } finally {
    button.disabled = false;
  }
}

async function startPayment() {
  const email = getEmail('pay-email');
  const message = document.getElementById('auth-message');

  if (!email) {
    message.textContent =
      'Enter the email address you will use for payment.';
    return;
  }

  setButtonDisabled('pay-button', true);
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
      throw new Error(
        result.error || 'Unable to start payment.'
      );
    }

    window.location.href = result.authorization_url;
  } catch (error) {
    console.error(error);
    message.textContent = error.message;
    setButtonDisabled('pay-button', false);
  }
}

async function restoreSession() {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (session) {
    await handleAuthenticatedSession(session);
  }

  supabaseClient.auth.onAuthStateChange(
    async (_event, updatedSession) => {
      if (!updatedSession) {
        return;
      }

      await handleAuthenticatedSession(updatedSession);
    }
  );
}

async function handleAuthenticatedSession(session) {
  const claimPasswordSection =
    document.getElementById('claim-password-section');

  if (claimPasswordSection && claimEmail) {
    claimPasswordSection.hidden = false;
  }

  await checkAccess(session.access_token);
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
      window.dispatchEvent(
        new CustomEvent('paid-access-granted')
      );
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

function setButtonDisabled(buttonId, disabled) {
  const button = document.getElementById(buttonId);

  if (button) {
    button.disabled = disabled;
  }
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
