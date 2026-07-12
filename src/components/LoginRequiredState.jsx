import Button from "./ui/Button";

function LoginRequiredState({
  message = "İçeriklerinizi takip etmek ve ilerlemenizi kaydetmek için giriş yapın.",
  onLoginClick,
}) {
  return (
    <section className="form-section login-required-state">
      <p>{message}</p>

      <div className="login-required-actions">
        <Button onClick={onLoginClick}>Giriş Yap</Button>
      </div>
    </section>
  );
}

export default LoginRequiredState;
