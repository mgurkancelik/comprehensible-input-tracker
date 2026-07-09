import { useState } from "react";

function AuthScreen({ mode, onModeChange, onLogin, onRegister, isLoading, error }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const isRegister = mode === "register";

  const handleSubmit = (event) => {
    event.preventDefault();

    if (isRegister) {
      onRegister({ name, email, password });
    } else {
      onLogin({ email, password });
    }
  };

  return (
    <main className="app">
      <header className="header">
        <h1>Comprehensible Input Tracker</h1>
        <p>Devam etmek için giriş yap ya da hesap oluştur.</p>
      </header>

      <section className="form-section">
        <div className="page-title">
          <h2>{isRegister ? "Hesap Oluştur" : "Giriş Yap"}</h2>
        </div>

        <form onSubmit={handleSubmit} className="content-form">
          <fieldset className="form-fieldset">
            <legend className="fieldset-legend">Hesap Bilgisi</legend>

            <div className="field-grid field-grid--primary">
              {isRegister && (
                <label className="field" htmlFor="auth-name">
                  <span className="field-label">Ad</span>
                  <input
                    id="auth-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Adın"
                  />
                </label>
              )}

              <label className="field" htmlFor="auth-email">
                <span className="field-label">Email</span>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="ornek@mail.com"
                />
              </label>

              <label className="field" htmlFor="auth-password">
                <span className="field-label">Şifre</span>
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="En az 6 karakter"
                />
              </label>
            </div>
          </fieldset>

          {error && <p className="empty-text">{error}</p>}

          <div className="form-submit-row">
            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading
                ? "Bekleyin..."
                : isRegister
                ? "Hesap Oluştur"
                : "Giriş Yap"}
            </button>
          </div>
        </form>

        <p>
          {isRegister ? "Zaten hesabın var mı? " : "Hesabın yok mu? "}
          <button
            type="button"
            className="card-notes-btn"
            onClick={() => onModeChange(isRegister ? "login" : "register")}
          >
            {isRegister ? "Giriş yap" : "Hesap oluştur"}
          </button>
        </p>
      </section>
    </main>
  );
}

export default AuthScreen;
