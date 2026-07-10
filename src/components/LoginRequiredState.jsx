function LoginRequiredState({
  message = "İçeriklerinizi takip etmek ve ilerlemenizi kaydetmek için giriş yapın.",
  onLoginClick,
}) {
  return (
    <section className="form-section login-required-state">
      <p>{message}</p>

      <div className="login-required-actions">
        <button type="button" className="submit-btn" onClick={onLoginClick}>
          Giriş Yap
        </button>
      </div>
    </section>
  );
}

export default LoginRequiredState;
