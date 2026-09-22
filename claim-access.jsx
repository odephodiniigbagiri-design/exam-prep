export default function ClaimAccess() {
  const [email, setEmail] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    await fetch("/api/claim-access", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email })
    });
  };

  return (
    <div className="max-w-md mx-auto">
      <h1>Claim Existing Access</h1>

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email used for payment"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button type="submit">
          Verify Payment
        </button>
      </form>
    </div>
  );
}
